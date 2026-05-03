/**
 * @file order-completed.ts
 * @description Plain-text email templates for the order-completed event.
 *   Two emails fire: one to the orderer (order is done) and one to the swiper
 *   (confirms completion and that transfer is on its way).
 *   Called by: app/api/orders/[id]/status/route.ts
 */

/**
 * Generates the plain-text body for the orderer's order-completed notification.
 * @param ordererName - The orderer's display name
 * @param restaurantName - The restaurant the order was placed at
 * @returns Plain-text email body
 * @called-by app/api/orders/[id]/status/route.ts
 */
export function orderCompletedOrdText({
  ordererName,
  restaurantName,
}: {
  ordererName: string
  restaurantName: string
}): string {
  return `Hi ${ordererName},

Your order at ${restaurantName} has been completed. Enjoy!

— Goober Eats`
}

/**
 * Generates the plain-text body for the swiper's completion confirmation.
 * @param swiperName - The swiper's display name
 * @param restaurantName - The restaurant the order was placed at
 * @param totalCents - The order total in cents
 * @returns Plain-text email body
 * @called-by app/api/orders/[id]/status/route.ts
 */
export function orderCompletedSwipText({
  swiperName,
  restaurantName,
  totalCents,
}: {
  swiperName: string
  restaurantName: string
  totalCents: number
}): string {
  const total = (totalCents / 100).toFixed(2)
  return `Hi ${swiperName},

Nice work! You've completed the order at ${restaurantName} ($${total}). Your payout is on its way.

— Goober Eats`
}
