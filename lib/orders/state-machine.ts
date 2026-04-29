/**
 * @file state-machine.ts
 * @description Defines valid order status transitions and exposes a guard function.
 *   Called by: app/api/orders/[id]/accept/route.ts, app/api/orders/[id]/status/route.ts
 * @dependencies lib/types/database.ts
 */

import type { OrderStatus } from '@/lib/types/database'

const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'open'],
  completed: [],
  cancelled: [],
}

/**
 * Returns true when the order may transition from `from` → `to`. Allowed
 * edges: open → in_progress, open → cancelled, in_progress → completed,
 * in_progress → open (un-accept). Terminal states (completed, cancelled)
 * have no outgoing edges.
 * @param from - The order's current status
 * @param to - The desired next status
 * @returns true when the transition is in the state-machine table
 * @called-by app/api/orders/[id]/accept/route.ts, app/api/orders/[id]/status/route.ts
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return validTransitions[from].includes(to)
}
