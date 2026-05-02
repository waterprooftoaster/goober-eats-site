/**
 * @file order-placed.ts
 * @description Plain-text email template for the order-placed confirmation sent to the orderer.
 *   Called by: app/api/stripe/webhooks/route.ts
 */

/**
 * Generates the plain-text body for the order-placed confirmation email.
 * @param ordererName - The orderer's display name
 * @param restaurantName - The restaurant the order was placed at
 * @param totalCents - The total the orderer will pay, in cents
 * @param orderId - The Goober Eats order UUID
 * @returns Plain-text email body
 * @called-by app/api/stripe/webhooks/route.ts
 */
export function orderPlacedText({
  ordererName,
  restaurantName,
  totalCents,
  orderId,
}: {
  ordererName: string
  restaurantName: string
  totalCents: number
  orderId: string
}): string {
  const total = (totalCents / 100).toFixed(2)
  return `Hi ${ordererName},

Your order at ${restaurantName} has been placed! We're finding a swiper for you now.

Order total: $${total}
Order ID: ${orderId}

— Goober Eats`
}
