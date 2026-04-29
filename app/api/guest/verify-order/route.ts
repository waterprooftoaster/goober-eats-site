/**
 * @file route.ts
 * @description GET endpoint that verifies a guest order by Stripe PaymentIntent ID,
 *   sets the guest auth cookie, and redirects to the order page. Single DB lookup
 *   per call: if the order is found, redirect; if not (webhook hasn't landed yet),
 *   render a tiny waiting page with a meta-refresh tag so the browser drives the
 *   retry. Server function exits in <50ms either way.
 *   Called by: app/checkout/return/page.tsx (guest checkout return)
 * @dependencies lib/supabase/service.ts, lib/api/guest-auth.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { guestOrderCookieName } from '@/lib/api/guest-auth'

const PI_ID_RE = /^pi_[a-zA-Z0-9_]+$/
const META_REFRESH_SECONDS = 1

/**
 * Verifies a guest order by Stripe PaymentIntent ID, sets the auth cookie, and redirects to the order page.
 * @returns 307 redirect to /order/:id on success; 400/403/500 on failure;
 *   200 HTML waiting page (meta-refresh) when the webhook has not yet landed.
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

  const { data, error } = await supabase
    .from('orders')
    .select('id, guest_access_token')
    .eq('stripe_payment_intent_id', piId)
    .maybeSingle()

  if (error) {
    console.error('verify-order: Supabase query failed', { piId, error })
    return NextResponse.json({ error: 'Failed to verify order' }, { status: 500 })
  }

  if (data === null) {
    // Webhook hasn't landed yet — return a waiting page that auto-refreshes
    // back to this same endpoint. Browser drives the retry; server function
    // exits immediately (no 5s blocking poll).
    return new NextResponse(buildWaitingPage(piId), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  if (!data.guest_access_token) {
    return NextResponse.json({ error: 'Order is not a guest order' }, { status: 403 })
  }

  const url = new URL(`/order/${data.id}`, request.url)
  const response = NextResponse.redirect(url)
  response.cookies.set(guestOrderCookieName(data.id), data.guest_access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  return response
}

// --- Helpers ---

/**
 * Renders the meta-refresh waiting page shown while the Stripe webhook is in
 * flight. Browser auto-refreshes back to this same endpoint after a second;
 * each call is a single DB lookup.
 * @param piId - Stripe PaymentIntent id, embedded in the refresh URL
 * @returns HTML string
 */
function buildWaitingPage(piId: string): string {
  const refreshUrl = `/api/guest/verify-order?pi_id=${encodeURIComponent(piId)}`
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="${META_REFRESH_SECONDS};url=${refreshUrl}">
  <title>Finalizing your order…</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; color: #111; background: #fafafa; }
    .card { text-align: center; }
    .spinner { width: 32px; height: 32px; border: 3px solid #e5e5e5; border-top-color: #111; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner" aria-hidden="true"></div>
    <p>Finalizing your order…</p>
  </div>
</body>
</html>`
}
