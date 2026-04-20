/**
 * @file route.ts
 * @description GET endpoint that verifies a guest order by Stripe PaymentIntent ID, sets the
 *   guest auth cookie, and redirects to the order page. Polls up to 5 times to handle
 *   webhook delivery lag.
 *   Called by: app/checkout/return/page.tsx (guest checkout return)
 * @dependencies lib/supabase/service.ts, lib/api/guest-auth.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { guestOrderCookieName } from '@/lib/api/guest-auth'

const PI_ID_RE = /^pi_[a-zA-Z0-9_]+$/
const MAX_ATTEMPTS = 5
const RETRY_DELAY_MS = 1000

/**
 * Verifies a guest order by Stripe PaymentIntent ID, sets the auth cookie, and redirects to the order page.
 * @returns Redirect to /order/:id on success; 400/403/404/500 on failure
 * @called-by app/checkout/return/page.tsx (guest checkout return)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const piId = searchParams.get('pi_id')

  if (!piId) {
    return NextResponse.json({ error: 'Missing pi_id parameter' }, { status: 400 })
  }

  if (!PI_ID_RE.test(piId)) {
    return NextResponse.json({ error: 'Invalid pi_id format' }, { status: 400 })
  }

  const supabase = createServiceClient()

  let order: { id: string; guest_access_token: string } | null = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, guest_access_token')
      .eq('stripe_payment_intent_id', piId)
      .maybeSingle()

    if (error) {
      console.error('verify-order: Supabase query failed', { attempt, piId, error })
      return NextResponse.json(
        { error: 'Failed to verify order' },
        { status: 500 }
      )
    }

    if (data !== null) {
      if (!data.guest_access_token) {
        return NextResponse.json(
          { error: 'Order is not a guest order' },
          { status: 403 }
        )
      }
      order = data
      break
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise<void>(resolve => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }

  if (!order) {
    console.warn(
      `verify-order: order not found after ${MAX_ATTEMPTS} attempts — webhook may not have fired`,
      { piId }
    )
    return NextResponse.json(
      { error: 'Order not found — payment may still be processing' },
      { status: 404 }
    )
  }

  const url = new URL(`/order/${order.id}`, request.url)
  const response = NextResponse.redirect(url)
  response.cookies.set(guestOrderCookieName(order.id), order.guest_access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  return response
}
