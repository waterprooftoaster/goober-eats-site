/**
 * @file complaint-eligibility.ts
 * @description Pure helpers for the 24-hour complaint window. Used by the API
 *   route, the order history page, and the chat completion view to gate the
 *   "Report a problem" affordance. The DB trigger in
 *   supabase/migrations/20260430000001_complaints_table.sql enforces the same
 *   rule server-side; this module is the application-layer mirror.
 *   Called by: app/api/orders/[id]/complaints/route.ts, app/orders/page.tsx,
 *     components/chat/order-completion-notice.tsx
 */

export const COMPLAINT_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Returns true when a complaint may be filed against the order — i.e. the
 * order completed in the last 24 hours and the timestamp is sane.
 * @param completedAt - ISO string or Date of orders.completed_at; null when the order has not completed
 * @param now - Reference time, defaults to Date.now()
 * @returns true when a complaint is eligible, false otherwise (including for invalid input)
 * @called-by app/api/orders/[id]/complaints/route.ts, app/orders/page.tsx,
 *   components/chat/order-completion-notice.tsx
 */
export function isWithinComplaintWindow(
  completedAt: string | Date | null,
  now: Date = new Date()
): boolean {
  if (completedAt == null) return false
  const completedMs =
    completedAt instanceof Date ? completedAt.getTime() : Date.parse(completedAt)
  if (Number.isNaN(completedMs)) return false
  const elapsed = now.getTime() - completedMs
  // Future completedAt (clock skew) is not eligible — cap at 0.
  if (elapsed < 0) return false
  return elapsed < COMPLAINT_WINDOW_MS
}
