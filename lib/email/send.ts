/**
 * @file send.ts
 * @description Email sending utilities: low-level fire-and-forget Resend wrapper and
 *   high-level order lifecycle helpers that handle profile lookups before sending.
 *   All public functions return void; callers use `void fn()` for fire-and-forget.
 *   Called by: app/api/stripe/webhooks/route.ts, app/api/orders/[id]/accept/route.ts,
 *              app/api/orders/[id]/status/route.ts
 * @dependencies resend, lib/supabase/service.ts, lib/email/templates/*
 */

import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/service'
import { orderPlacedText } from '@/lib/email/templates/order-placed'
import { orderAcceptedOrdText, orderAcceptedSwipText } from '@/lib/email/templates/order-accepted'
import { orderCompletedOrdText, orderCompletedSwipText } from '@/lib/email/templates/order-completed'
import { orderNewSwipText } from '@/lib/email/templates/order-new'
import { orderCancelledOrdText } from '@/lib/email/templates/order-cancelled'
import type Stripe from 'stripe'

export interface EmailParams {
  to: string
  subject: string
  text: string
}

const SENDER = 'Goober Eats <noreply@goobereats.net>'
const RETRY_DELAY_MS = 7_000

/**
 * Sends a plain-text email via Resend; fires and forgets with one auto-retry.
 * @param params - Recipient, subject, and plain-text body
 * @called-by order lifecycle helpers in this file
 */
export function sendEmail(params: EmailParams): void {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('sendEmail: RESEND_API_KEY not set — skipping')
    return
  }
  sendWithRetry(new Resend(apiKey), params)
}

/**
 * Looks up the orderer's email and fires an order-placed confirmation.
 * Uses the service client already in scope from the webhook handler.
 * @param ordererId - Auth orderer's user ID, or null for guest checkout
 * @param isGuest - True when the order came through guest checkout
 * @param guestName - Guest display name (null for auth flow)
 * @param pi - Stripe PaymentIntent; provides receipt_email for guest orders
 * @param restaurantName - Restaurant name from validated order metadata
 * @param totalCents - Total the orderer pays, in cents
 * @param orderId - The created order UUID
 * @called-by app/api/stripe/webhooks/route.ts
 */
export async function sendOrderPlacedEmail({
  ordererId,
  isGuest,
  guestName,
  pi,
  restaurantName,
  totalCents,
  orderId,
}: {
  ordererId: string | null | undefined
  isGuest: boolean
  guestName: string | null
  pi: Pick<Stripe.PaymentIntent, 'receipt_email'>
  restaurantName: string
  totalCents: number
  orderId: string
}): Promise<void> {
  let email: string | null = null
  let name = 'there'

  if (!isGuest && ordererId) {
    const { data } = await createServiceClient()
      .from('profiles')
      .select('email, full_name')
      .eq('id', ordererId)
      .single()
    email = data?.email ?? null
    name = data?.full_name ?? 'there'
  } else {
    email = pi.receipt_email ?? null
    name = guestName ?? 'there'
  }

  if (!email) return

  sendEmail({
    to: email,
    subject: `Your order at ${restaurantName} is confirmed`,
    text: orderPlacedText({ ordererName: name, restaurantName, totalCents, orderId }),
  })
}

/**
 * Looks up orderer + swiper emails and fires acceptance notifications to both.
 * @param updated - The updated order row returned after the atomic accept claim
 * @param swiperId - The swiper's user ID (user.id from the accept route)
 * @called-by app/api/orders/[id]/accept/route.ts
 */
export async function sendOrderAcceptedEmails({
  updated,
  swiperId,
}: {
  updated: {
    orderer_id: string | null
    guest_email: string | null
    guest_name: string | null
    restaurant_name: string
    total_cents: number
  }
  swiperId: string
}): Promise<void> {
  const service = createServiceClient()

  const [ordererProfileRes, swiperProfileRes] = await Promise.all([
    updated.orderer_id
      ? service.from('profiles').select('email, full_name').eq('id', updated.orderer_id).single()
      : Promise.resolve({ data: { email: updated.guest_email ?? null, full_name: updated.guest_name ?? null } }),
    service.from('profiles').select('email, full_name').eq('id', swiperId).single(),
  ])

  const ordEmail = ordererProfileRes.data?.email
  const ordName = ordererProfileRes.data?.full_name ?? 'there'
  const swipEmail = swiperProfileRes.data?.email
  const swipName = swiperProfileRes.data?.full_name ?? 'there'

  if (ordEmail) {
    sendEmail({
      to: ordEmail,
      subject: `A swiper accepted your order at ${updated.restaurant_name}`,
      text: orderAcceptedOrdText({ ordererName: ordName, restaurantName: updated.restaurant_name }),
    })
  }
  if (swipEmail) {
    sendEmail({
      to: swipEmail,
      subject: `You accepted an order at ${updated.restaurant_name}`,
      text: orderAcceptedSwipText({
        swiperName: swipName,
        restaurantName: updated.restaurant_name,
        totalCents: updated.total_cents,
      }),
    })
  }
}

/**
 * Looks up orderer + swiper emails and fires completion notifications to both.
 * @param updated - The completed order row returned after the status update
 * @called-by app/api/orders/[id]/status/route.ts
 */
export async function sendOrderCompletedEmails({
  updated,
}: {
  updated: {
    orderer_id: string | null
    swiper_id: string | null
    guest_email: string | null
    guest_name: string | null
    restaurant_name: string
    total_cents: number
  }
}): Promise<void> {
  const service = createServiceClient()

  const [ordererProfileRes, swiperProfileRes] = await Promise.all([
    updated.orderer_id
      ? service.from('profiles').select('email, full_name').eq('id', updated.orderer_id).single()
      : Promise.resolve({ data: { email: updated.guest_email ?? null, full_name: updated.guest_name ?? null } }),
    updated.swiper_id
      ? service.from('profiles').select('email, full_name').eq('id', updated.swiper_id).single()
      : Promise.resolve({ data: null }),
  ])

  const ordEmail = ordererProfileRes.data?.email
  const ordName = ordererProfileRes.data?.full_name ?? 'there'
  const swipEmail = swiperProfileRes.data?.email
  const swipName = swiperProfileRes.data?.full_name ?? 'there'

  if (ordEmail) {
    sendEmail({
      to: ordEmail,
      subject: `Your order at ${updated.restaurant_name} is complete`,
      text: orderCompletedOrdText({ ordererName: ordName, restaurantName: updated.restaurant_name }),
    })
  }
  if (swipEmail) {
    sendEmail({
      to: swipEmail,
      subject: `Order at ${updated.restaurant_name} completed`,
      text: orderCompletedSwipText({
        swiperName: swipName,
        restaurantName: updated.restaurant_name,
        totalCents: updated.total_cents,
      }),
    })
  }
}

/**
 * Queries all swipers at the given school and fires a new-order notification to each.
 * @param schoolId - The school UUID to scope the swiper query
 * @param restaurantName - The restaurant name to include in the notification
 * @called-by app/api/stripe/webhooks/route.ts
 */
export async function sendNewOrderToSwipers({
  schoolId,
  restaurantName,
}: {
  schoolId: string
  restaurantName: string
}): Promise<void> {
  const { data: swipers } = await createServiceClient()
    .from('profiles')
    .select('email, full_name')
    .eq('school_id', schoolId)
    .eq('is_swiper', true)

  if (!swipers || swipers.length === 0) return

  for (const swiper of swipers as Array<{ email: string | null; full_name: string | null }>) {
    if (!swiper.email) continue
    sendEmail({
      to: swiper.email,
      subject: `New order at ${restaurantName} — claim it now`,
      text: orderNewSwipText({ swiperName: swiper.full_name ?? 'there', restaurantName }),
    })
  }
}

/**
 * Looks up the orderer's email and fires an order-cancelled confirmation.
 * @param updated - The cancelled order row; provides orderer_id (auth) or guest_email (guest)
 * @called-by app/api/orders/[id]/status/route.ts
 */
export async function sendOrderCancelledEmail({
  updated,
}: {
  updated: {
    orderer_id: string | null
    guest_email: string | null
    guest_name: string | null
    restaurant_name: string
  }
}): Promise<void> {
  let email: string | null = null
  let name = 'there'

  if (updated.orderer_id) {
    const { data } = await createServiceClient()
      .from('profiles')
      .select('email, full_name')
      .eq('id', updated.orderer_id)
      .single()
    email = data?.email ?? null
    name = data?.full_name ?? 'there'
  } else {
    email = updated.guest_email ?? null
    name = updated.guest_name ?? 'there'
  }

  if (!email) return

  sendEmail({
    to: email,
    subject: `Your order at ${updated.restaurant_name} has been cancelled`,
    text: orderCancelledOrdText({ ordererName: name, restaurantName: updated.restaurant_name }),
  })
}

// --- Helpers ---

/**
 * Attempts one Resend delivery; schedules a single retry after RETRY_DELAY_MS on failure.
 * @param resend - Resend client instance
 * @param params - Email params to deliver
 * @called-by sendEmail
 */
function sendWithRetry(resend: Resend, params: EmailParams): void {
  resend.emails
    .send({ from: SENDER, to: params.to, subject: params.subject, text: params.text })
    .catch((err: unknown) => {
      console.error('sendEmail: first attempt failed, retrying in 7 s', err)
      setTimeout(() => {
        resend.emails
          .send({ from: SENDER, to: params.to, subject: params.subject, text: params.text })
          .catch((retryErr: unknown) => {
            console.error('sendEmail: retry failed', retryErr)
          })
      }, RETRY_DELAY_MS)
    })
}
