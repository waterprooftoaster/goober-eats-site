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

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return validTransitions[from].includes(to)
}
