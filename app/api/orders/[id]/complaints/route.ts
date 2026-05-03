/**
 * @file route.ts
 * @description POST/GET endpoints for order complaints. POST inserts a new
 *   complaint, runs the AI adjudicator, and (on `approve_refund`) fires a
 *   Stripe refund inline. GET returns the (single) complaint for the order.
 *   Authenticated orderers only — guests cannot file complaints. The 24-hour
 *   eligibility window is enforced here, in the orders DB CHECK trigger
 *   (defense in depth), and at the UI layer.
 *   Called by: components/orders/complaint-form.tsx,
 *     components/chat/order-completion-notice.tsx,
 *     app/orders/[id]/complaints/new/page.tsx
 * @dependencies lib/supabase/server.ts, lib/supabase/service.ts,
 *   lib/api/helpers.ts, lib/orders/complaint-eligibility.ts,
 *   lib/types/api.ts, lib/ai/complaint-adjudicator.ts, lib/stripe/refund.ts,
 *   lib/storage/sign-screenshots.ts
 */

import { NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { createComplaintSchema } from '@/lib/types/api'
import { isWithinComplaintWindow } from '@/lib/orders/complaint-eligibility'
import {
  adjudicateComplaint,
  type AdjudicationResult,
} from '@/lib/ai/complaint-adjudicator'
import { refundOrder } from '@/lib/stripe/refund'
import type { ComplaintVerdict } from '@/lib/types/database'
import {
  signCartScreenshotPaths,
  signCompletionPhotoPath,
} from '@/lib/storage/sign-screenshots'

/**
 * Files an order complaint. Validates eligibility, persists the row, runs the
 * AI adjudicator, and on approve_refund issues a Stripe refund inline.
 * @param request - JSON body validated by createComplaintSchema
 * @param params - Route params containing the order UUID
 * @returns The persisted complaint row, or an error response
 * @called-by components/orders/complaint-form.tsx
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params

  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) return apiError('Unauthorized', 401)

  const body = await request.json().catch(() => null)
  const parsed = createComplaintSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
  }
  const { category, reason_text } = parsed.data

  const service = createServiceClient()

  // Three independent reads — fan out and join. Order/RLS gate for the orderer,
  // existing-complaint guard, and the conversation lookup that drives the
  // completion-photo fetch all run against orderId only.
  const [orderRead, existingRead, convoRead] = await Promise.all([
    supabase
      .from('orders')
      .select('id, orderer_id, status, completed_at, restaurant_name, total_cents, cart_screenshot_urls')
      .eq('id', orderId)
      .maybeSingle(),
    supabase
      .from('complaints')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle(),
    service
      .from('conversations')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle(),
  ])
  const order = orderRead.data

  if (!order) return apiError('Order not found', 404)
  if (order.orderer_id !== user.id) {
    return apiError('Only the orderer may file a complaint', 403)
  }
  if (order.status !== 'completed') {
    return apiError('Order is not completed', 400)
  }
  if (!isWithinComplaintWindow(order.completed_at)) {
    return apiError('The 24-hour complaint window has expired', 410)
  }

  // One-per-order guard at the API layer; the DB UNIQUE constraint is the
  // ultimate backstop, but checking here keeps the error message precise.
  if (existingRead.data) {
    return apiError('A complaint has already been filed for this order', 409)
  }

  // Latest completion photo image_url. Read via service client because the
  // orderer's RLS view of messages may filter completion_photo entries.
  let completionImagePath: string | null = null
  if (convoRead.data?.id) {
    const { data: msg } = await service
      .from('messages')
      .select('image_url')
      .eq('conversation_id', convoRead.data.id)
      .eq('message_type', 'completion_photo')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    completionImagePath = msg?.image_url ?? null
  }

  // Insert the complaint row + sign the URLs we feed to the AI in parallel.
  // Insert depends on nothing from the signing; both are independent and the
  // adjudicator needs all three before it can run.
  const [insertResult, cartUrls, completionUrl] = await Promise.all([
    service
      .from('complaints')
      .insert({
        order_id: orderId,
        complainant_id: user.id,
        category,
        reason_text,
      })
      .select('id')
      .maybeSingle(),
    signCartScreenshotPaths(
      (order.cart_screenshot_urls as string[] | null) ?? []
    ),
    completionImagePath
      ? signCompletionPhotoPath(completionImagePath)
      : Promise.resolve(null),
  ])

  const { data: inserted, error: insertError } = insertResult
  if (insertError || !inserted) {
    const detail = insertError?.message ?? 'Insert failed'
    return apiError(`Could not file complaint: ${detail}`, 409)
  }

  // Run the adjudicator. Adapter never throws — failures surface as escalate
  // — but we still wrap so a thrown promise rejection cannot brick the route.
  let verdict: AdjudicationResult
  try {
    verdict = await adjudicateComplaint({
      cartScreenshotSignedUrls: cartUrls,
      completionPhotoSignedUrl: completionUrl,
      category,
      reasonText: reason_text,
      orderRestaurantName: order.restaurant_name,
      orderTotalCents: order.total_cents,
    })
  } catch (err) {
    console.error('complaints route: adjudicator threw, leaving pending', { err })
    const { data: pendingRow } = await service
      .from('complaints')
      .select('id, verdict, ai_confidence, refund_amount_cents, stripe_refund_id, resolved_at')
      .eq('id', inserted.id)
      .maybeSingle()
    return apiSuccess({ complaint: pendingRow })
  }

  let refundAmountCents: number | null = null
  let stripeRefundId: string | null = null
  let finalVerdict: ComplaintVerdict = verdict.verdict
  let resolvedAt: string | null = null

  // Rate-limit auto-refunds: if this orderer already had an approve_refund in
  // the last 7 days, downgrade to 'escalate' so a human reviews. The refund
  // still happens — it just routes through ops review instead of inline.
  if (verdict.verdict === 'approve_refund') {
    const rateLimited = await hasRecentApprovedRefund(service, user.id)
    if (rateLimited) {
      finalVerdict = 'escalate'
    } else {
      try {
        const refund = await refundOrder(orderId, `complaint-refund-${inserted.id}`)
        refundAmountCents = refund.amountCents
        stripeRefundId = refund.refundId
        resolvedAt = new Date().toISOString()
      } catch (err) {
        console.error('complaints route: refund failed; leaving complaint pending', { err })
        finalVerdict = 'pending'
      }
    }
  } else if (verdict.verdict === 'deny') {
    resolvedAt = new Date().toISOString()
  }

  const { data: updatedRow } = await service
    .from('complaints')
    .update({
      verdict: finalVerdict,
      ai_reasoning: verdict,
      ai_confidence: verdict.confidence,
      refund_amount_cents: refundAmountCents,
      stripe_refund_id: stripeRefundId,
      resolved_at: resolvedAt,
    })
    .eq('id', inserted.id)
    .select('id, verdict, ai_confidence, refund_amount_cents, stripe_refund_id, resolved_at')
    .maybeSingle()

  return apiSuccess({ complaint: updatedRow })
}

/**
 * Returns the existing complaint row for an order, or 404 if none exists.
 * RLS on the complaints table scopes selection to the complainant.
 * @param request - GET request (unused body)
 * @param params - Route params containing the order UUID
 * @returns Complaint row or 404
 * @called-by client UI gating + the order history page
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) return apiError('Unauthorized', 401)

  const { data: complaint } = await supabase
    .from('complaints')
    .select('id, order_id, category, verdict, ai_confidence, refund_amount_cents, stripe_refund_id, created_at, resolved_at')
    .eq('order_id', orderId)
    .maybeSingle()

  if (!complaint) return apiError('No complaint found for this order', 404)
  return apiSuccess({ complaint })
}

// --- Helpers ---

const REFUND_RATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Returns true if the user already had an `approve_refund` complaint resolved
 * within the rate-limit window. Throttles auto-refund abuse by routing repeat
 * claimants to human review instead of issuing back-to-back inline refunds.
 * @param service - Service-role Supabase client
 * @param userId - Complainant id (auth.uid())
 * @returns true when a recent approve_refund exists; false otherwise
 * @called-by POST /api/orders/[id]/complaints
 */
async function hasRecentApprovedRefund(
  service: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<boolean> {
  const since = new Date(Date.now() - REFUND_RATE_WINDOW_MS).toISOString()
  const { data } = await service
    .from('complaints')
    .select('id')
    .eq('complainant_id', userId)
    .eq('verdict', 'approve_refund')
    .gte('resolved_at', since)
    .limit(1)
  return Array.isArray(data) && data.length > 0
}
