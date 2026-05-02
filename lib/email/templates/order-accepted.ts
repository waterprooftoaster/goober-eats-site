/**
 * @file order-accepted.ts
 * @description Plain-text email templates for the order-accepted event.
 *   Two emails fire: one to the orderer (a swiper is on the way) and one to the swiper
 *   (confirms their acceptance).
 *   Called by: app/api/orders/[id]/accept/route.ts
 */

/**
 * Generates the plain-text body for the orderer's "swiper accepted" notification.
 * @param ordererName - The orderer's display name
 * @param restaurantName - The restaurant the order was placed at
 * @returns Plain-text email body
 * @called-by app/api/orders/[id]/accept/route.ts
 */
export function orderAcceptedOrdText({
  ordererName,
  restaurantName,
}: {
  ordererName: string
  restaurantName: string
}): string {
  return `Hi ${ordererName},

Great news! A swiper has accepted your order at ${restaurantName} and is getting it for you.

— Goober Eats`
}

/**
 * Generates the plain-text body for the swiper's acceptance confirmation.
 * @param swiperName - The swiper's display name
 * @param restaurantName - The restaurant the order is from
 * @param totalCents - The order total in cents (what the orderer paid)
 * @returns Plain-text email body
 * @called-by app/api/orders/[id]/accept/route.ts
 */
export function orderAcceptedSwipText({
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

You've accepted an order at ${restaurantName}. Order total: $${total}.

Head to the app to chat with the orderer and complete the order.

— Goober Eats`
}
