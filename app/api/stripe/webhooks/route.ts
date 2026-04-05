import { NextRequest } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/service'
import { loadCart } from '@/lib/cart/load'
import { platformFeeCents } from '@/lib/pricing'
import { apiError, apiSuccess } from '@/lib/api/helpers'
import type Stripe from 'stripe'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET is not set')
        return apiError('Server configuration error', 500)
    }

    const body = await request.text()
    const signature = request.headers.get('stripe-signature')
    if (!signature) return apiError('Missing stripe-signature header', 400)

    let event: Stripe.Event
    try {
        event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
    } catch {
        console.warn('webhook: invalid signature — check STRIPE_WEBHOOK_SECRET matches stripe listen output')
        return apiError('Invalid webhook signature', 400)
    }

    console.log(`webhook received: ${event.type}`, { eventId: event.id })

    const supabase = createServiceClient()

    switch (event.type) {
        case 'payment_intent.succeeded': {
            const pi = event.data.object as Stripe.PaymentIntent
            const meta = pi.metadata
            console.log('payment_intent.succeeded: processing', { piId: pi.id, isGuest: meta.is_guest === 'true' })

            // Checkout flow: cart_id in metadata means this PI came from Stripe Checkout
            const cartId = meta.cart_id
            if (!cartId) {
                console.warn('payment_intent.succeeded: skip — no cart_id', { piId: pi.id })
                break
            }

            const eateryId = meta.eatery_id
            const isGuest = meta.is_guest === 'true'
            const guestName = isGuest ? meta.guest_name : null
            const ordererId = isGuest ? null : meta.orderer_id

            // Validate required fields
            if (isGuest && !guestName) {
                console.warn('payment_intent.succeeded: skip — guest missing name', { piId: pi.id })
                break
            }
            if (!isGuest && !ordererId) {
                console.warn('payment_intent.succeeded: skip — auth missing orderer_id', { piId: pi.id })
                break
            }
            if (!eateryId) {
                console.warn('payment_intent.succeeded: skip — no eatery_id', { piId: pi.id })
                break
            }

            // Validate UUIDs
            if (!UUID_RE.test(cartId) || !UUID_RE.test(eateryId)) {
                console.warn('payment_intent.succeeded: skip — invalid cart/eatery UUID', { piId: pi.id })
                break
            }
            if (ordererId && !UUID_RE.test(ordererId)) {
                console.warn('payment_intent.succeeded: skip — invalid orderer UUID', { piId: pi.id, ordererId })
                break
            }

            // Idempotency: skip if payment already recorded for this PI
            const { data: existingPayment, error: paymentCheckError } = await supabase
                .from('payments')
                .select('id')
                .eq('stripe_payment_intent_id', pi.id)
                .maybeSingle()

            if (paymentCheckError) {
                console.error('payment_intent.succeeded: idempotency check failed', { piId: pi.id, error: paymentCheckError })
                return apiError('Failed to check payment', 500)
            }

            if (existingPayment) {
                console.log('payment_intent.succeeded: skip — duplicate delivery', { piId: pi.id })
                break
            }

            // Load cart to get items + pricing
            const { data: cartRow, error: cartError } = await supabase
                .from('carts')
                .select('id, eatery_id, user_id')
                .eq('id', cartId)
                .single()

            if (cartError || !cartRow) {
                console.error('payment_intent.succeeded: cart lookup failed', { piId: pi.id, cartId, error: cartError })
                return apiError('Cart not found', 500)
            }

            // Cross-check: for auth orders, metadata orderer_id must match cart owner
            if (ordererId && cartRow.user_id && ordererId !== cartRow.user_id) {
                console.error('payment_intent.succeeded: orderer_id does not match cart owner', { piId: pi.id })
                return apiError('Cart owner mismatch', 500)
            }

            const loaded = await loadCart(supabase, cartRow)
            if (loaded.items.length === 0) {
                console.error(`payment_intent.succeeded: cart ${cartId} is empty`)
                break
            }

            const orderItems = loaded.items.map((item) => ({
                menu_item_id: item.menu_item_id,
                name: item.name,
                price_cents: item.price_cents,
                quantity: item.quantity,
            }))

            const totalItemCents = loaded.items.reduce(
                (sum, item) => sum + item.quantity * item.price_cents,
                0
            )
            // Bounds-check tip from metadata (mirrors checkout-session cap)
            const rawTip = parseInt(meta.tip_cents ?? '0', 10)
            const tipCents = Math.max(0, Math.min(rawTip, totalItemCents))
            const totalCents = totalItemCents + tipCents
            const feeCents = platformFeeCents(totalItemCents)
            const specialInstructions = (meta.special_instructions ?? '').slice(0, 500) || null

            // Create order — unified path for guest and auth.
            // stripe_payment_intent_id has a unique index, so on retry (when
            // the previous attempt created the order but payment insert failed)
            // the insert fails and we recover the existing order below.
            let orderId: string
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    orderer_id: ordererId,
                    eatery_id: cartRow.eatery_id,
                    stripe_payment_intent_id: pi.id,
                    items: orderItems,
                    total_cents: totalCents,
                    tip_cents: tipCents,
                    special_instructions: specialInstructions,
                    guest_name: guestName,
                    guest_phone: null,
                    guest_access_token: isGuest ? crypto.randomUUID() : null,
                })
                .select('id')
                .single()

            if (orderError) {
                // Retry path: order already exists from a previous attempt
                const { data: existing } = await supabase
                    .from('orders')
                    .select('id')
                    .eq('stripe_payment_intent_id', pi.id)
                    .single()

                if (!existing) {
                    console.error('payment_intent.succeeded: failed to create order', orderError)
                    return apiError('Failed to create order', 500)
                }
                orderId = existing.id
            } else {
                orderId = order.id
            }

            // Record payment — if this fails, return 500 so Stripe retries.
            // On retry the order already exists (recovered above via PI ID),
            // so we just need to insert the payment record.
            const { error: paymentError } = await supabase.from('payments').insert({
                order_id: orderId,
                stripe_payment_intent_id: pi.id,
                amount_cents: totalCents,
                platform_fee_cents: feeCents,
                status: 'succeeded',
                payer_id: ordererId,
                payee_id: null,
            })

            if (paymentError) {
                console.error('payment_intent.succeeded: failed to record payment', paymentError)
                return apiError('Failed to record payment', 500)
            }

            // Clean up cart
            await supabase.from('cart_items').delete().eq('cart_id', cartId)
            await supabase.from('carts').delete().eq('id', cartId)

            break
        }

        case 'payment_intent.payment_failed': {
            // No-op for checkout flow: no order exists in our DB until
            // payment_intent.succeeded fires. Stripe's embedded checkout keeps
            // the user on the payment page on failure.
            break
        }

        case 'checkout.session.completed': {
            // No-op: order creation is handled by payment_intent.succeeded.
            // Log for observability.
            const session = event.data.object as Stripe.Checkout.Session
            console.log(`checkout.session.completed: session ${session.id} (no-op)`)
            break
        }

        case 'checkout.session.expired': {
            // No-op: no order exists to clean up.
            break
        }

        case 'account.updated': {
            const account = event.data.object as Stripe.Account
            if (account.details_submitted && account.charges_enabled) {
                const { data: existing } = await supabase
                    .from('stripe_accounts')
                    .select('id, user_id')
                    .eq('stripe_account_id', account.id)
                    .maybeSingle()
                if (!existing) break

                console.log(`[webhook] account.updated: ${account.id}`)
                await supabase
                    .from('stripe_accounts')
                    .update({ onboarding_complete: true })
                    .eq('stripe_account_id', account.id)

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('school_id')
                    .eq('id', existing.user_id)
                    .single()

                if (profile?.school_id) {
                    await supabase
                        .from('profiles')
                        .update({ is_swiper: true })
                        .eq('id', existing.user_id)
                        .eq('is_swiper', false)
                } else {
                    console.warn(
                        `account.updated: skipping is_swiper activation for user ${existing.user_id} — no school_id set`
                    )
                }
            }
            break
        }
    }

    return apiSuccess({ received: true })
}
