/**
 * @file state-machine.ts
 * @description Defines valid order status transitions, the `canTransition`
 *   graph predicate, and the `canComplete` guard that blocks
 *   `in_progress → completed` when the backing payment is disputed.
 *   Called by: app/api/orders/[id]/accept/route.ts, app/api/orders/[id]/status/route.ts
 * @dependencies lib/types/database.ts
 */

import type { OrderStatus, Payment } from '@/lib/types/database'

type CompletionResult = { ok: true } | { ok: false; reason: string }

const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'open'],
  completed: [],
  cancelled: [],
}

/**
 * Pure graph predicate: is this status transition permitted by the state machine?
 * @param from - Current status
 * @param to - Proposed next status
 * @returns true iff the edge exists in the transitions graph
 * @called-by status/route.ts (pre-flight), accept/route.ts
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return validTransitions[from].includes(to)
}

/**
 * Guard for `in_progress → completed`: blocks completion while the payment
 *   is disputed so the platform doesn't transfer funds that may be clawed
 *   back by the cardholder's bank.
 * @param payment - The payment row backing the order, or null if missing
 * @returns { ok: true } when completion can proceed; { ok: false, reason }
 *   with a user-visible message otherwise
 * @called-by status/route.ts (completion branch)
 */
export function canComplete(payment: Payment | null): CompletionResult {
  if (!payment) {
    return { ok: false, reason: 'Order cannot be completed: payment not confirmed' }
  }
  if (payment.status === 'disputed') {
    return {
      ok: false,
      reason: 'Order cannot be completed: payment is currently disputed',
    }
  }
  if (payment.status !== 'succeeded') {
    return {
      ok: false,
      reason: 'Order cannot be completed: payment not confirmed',
    }
  }
  return { ok: true }
}
