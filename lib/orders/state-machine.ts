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
