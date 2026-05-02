/**
 * @file stripeAssertions.ts
 * @description Asserts a Goober Eats order has fully settled on Stripe in test mode:
 *   PaymentIntent succeeded with the right amount, the latest charge is captured,
 *   the platform created a Transfer to the swiper's connected account with
 *   `source_transaction = chargeId` (so it debits pending settlement), and the
 *   transfer amount equals total_cents − platform_fee_cents (i.e. platform retains
 *   the 10% fee implicitly via the two-step transfer model). Used by both the
 *   live-money Playwright spec and the assert-order-settled CLI wrapper.
 *   Called by: tests/e2e/authenticated/live-money.spec.ts, scripts/assert-order-settled.ts
 * @dependencies @supabase/supabase-js, lib/stripe/sdk
 */

import { createClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe/sdk'

interface AssertionOptions {
  pollIntervalMs?: number
  timeoutMs?: number
}

interface Settlement {
  paymentIntentId: string
  chargeId: string
  transferId: string
  chargeBalanceTxnId: string | null
}

/**
 * Asserts that the order has fully settled on Stripe (PI succeeded, charge captured,
 * transfer created with correct amount and source_transaction). Polls for the transfer
 * up to `timeoutMs` because the swiper's `complete` request creates the transfer
 * synchronously, but a paranoid retry loop allows for slight Stripe API propagation.
 * @param orderId - UUID of the order in the test Supabase database
 * @param opts - Override polling cadence (defaults: 1s interval, 30s timeout)
 * @returns Settlement summary (PI id, charge id, transfer id, charge balance-txn id)
 * @called-by tests/e2e/authenticated/live-money.spec.ts, scripts/assert-order-settled.ts
 */
export async function assertOrderSettled(
  orderId: string,
  opts: AssertionOptions = {}
): Promise<Settlement> {
  const pollIntervalMs = opts.pollIntervalMs ?? 1000
  const timeoutMs = opts.timeoutMs ?? 30_000

  const supabase = buildTestSupabase()

  const { data: order } = await supabase
    .from('orders')
    .select('stripe_payment_intent_id, total_cents')
    .eq('id', orderId)
    .single()

  if (!order || !order.stripe_payment_intent_id) {
    throw new Error(`order ${orderId} not paid: no stripe_payment_intent_id on row`)
  }

  const piId: string = order.stripe_payment_intent_id
  const totalCents: number = order.total_cents

  const { data: payment } = await supabase
    .from('payments')
    .select('amount_cents, platform_fee_cents')
    .eq('order_id', orderId)
    .single()

  if (!payment) {
    throw new Error(`order ${orderId} has no payment row`)
  }

  const stripe = getStripe()

  const pi = await stripe.paymentIntents.retrieve(piId, {
    expand: ['latest_charge.balance_transaction'],
  })

  if (pi.status !== 'succeeded') {
    throw new Error(`PI not succeeded for order ${orderId}: ${pi.status}`)
  }
  if (pi.amount_received !== payment.amount_cents) {
    throw new Error(
      `PI ${piId} amount_received=${pi.amount_received} does not match payments.amount_cents=${payment.amount_cents}`
    )
  }

  const charge = resolveLatestCharge(pi.latest_charge)
  if (!charge) {
    throw new Error(`PI ${piId} has null latest_charge — payment never captured`)
  }
  if (!charge.paid || !charge.captured) {
    throw new Error(`Charge ${charge.id} not paid/captured`)
  }

  const transfer = await pollForOrderTransfer(orderId, charge.id, {
    pollIntervalMs,
    timeoutMs,
  })

  if (transfer.source_transaction !== charge.id) {
    throw new Error(
      `transfer ${transfer.id} source_transaction=${transfer.source_transaction} does not match charge ${charge.id}`
    )
  }

  const expectedTransferAmount = payment.amount_cents - payment.platform_fee_cents
  if (transfer.amount !== expectedTransferAmount) {
    throw new Error(
      `transfer amount mismatch: expected ${expectedTransferAmount} (=${payment.amount_cents}-${payment.platform_fee_cents}), got ${transfer.amount}`
    )
  }

  // Realized platform fee = what the orderer paid minus what was transferred to
  // the swiper. Must match the fee the webhook recorded on the payment row
  // (which is `Math.round(subtotal_cents * 0.1)` per lib/pricing.ts:computeSplit).
  const realizedFee = totalCents - transfer.amount
  if (realizedFee !== payment.platform_fee_cents) {
    throw new Error(
      `platform fee math: expected ${payment.platform_fee_cents} (payments.platform_fee_cents), realized ${realizedFee} (total_cents − transfer.amount)`
    )
  }

  return {
    paymentIntentId: pi.id,
    chargeId: charge.id,
    transferId: transfer.id,
    chargeBalanceTxnId: resolveBalanceTxnId(charge.balance_transaction),
  }
}

// --- Helpers ---

function buildTestSupabase() {
  const url = process.env.TEST_SUPABASE_URL
  const key = process.env.TEST_SUPABASE_SECRET_KEY
  if (!url || !key) {
    throw new Error(
      'TEST_SUPABASE_URL / TEST_SUPABASE_SECRET_KEY not set — source .env.test or run scripts/test-money-up.sh first'
    )
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

interface ChargeLike {
  id: string
  paid: boolean
  captured: boolean
  balance_transaction: unknown
}

function resolveLatestCharge(latestCharge: unknown): ChargeLike | null {
  if (!latestCharge) return null
  if (typeof latestCharge === 'string') {
    throw new Error(
      `latest_charge returned as string ${latestCharge} — re-call with expand:['latest_charge.balance_transaction']`
    )
  }
  return latestCharge as ChargeLike
}

function resolveBalanceTxnId(bt: unknown): string | null {
  if (!bt) return null
  if (typeof bt === 'string') return bt
  return (bt as { id: string }).id
}

interface TransferLike {
  id: string
  amount: number
  source_transaction: string | null
  metadata: { order_id?: string } | null
}

async function pollForOrderTransfer(
  orderId: string,
  chargeId: string,
  opts: { pollIntervalMs: number; timeoutMs: number }
): Promise<TransferLike> {
  const stripe = getStripe()
  const startedAt = Date.now()

  while (Date.now() - startedAt < opts.timeoutMs) {
    const result = await stripe.transfers.list({ limit: 25 })
    const transfers = (result.data as unknown as TransferLike[]) ?? []
    const match = transfers.find((t) => t.metadata?.order_id === orderId)
    if (match) return match
    await sleep(opts.pollIntervalMs)
  }

  throw new Error(
    `no transfer for charge ${chargeId} (order ${orderId}) within ${opts.timeoutMs}ms — is the swiper's connected account active?`
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
