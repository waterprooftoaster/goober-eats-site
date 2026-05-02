/**
 * @file order-new.ts
 * @description Plain-text email template notifying a swiper of a new order at their school.
 *   Called by: lib/email/send.ts
 */

/**
 * Generates the plain-text body for the new-order notification sent to swipers.
 * @param swiperName - The swiper's display name
 * @param restaurantName - The restaurant the order was placed at
 * @returns Plain-text email body
 * @called-by lib/email/send.ts
 */
export function orderNewSwipText({
  swiperName,
  restaurantName,
}: {
  swiperName: string
  restaurantName: string
}): string {
  return `Hi ${swiperName},

A new order just came in for ${restaurantName} at your school. Log in to Goober Eats to claim it.

— Goober Eats`
}
