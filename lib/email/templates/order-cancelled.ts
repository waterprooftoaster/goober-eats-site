/**
 * @file order-cancelled.ts
 * @description Plain-text email template confirming an order cancellation to the orderer.
 *   Called by: lib/email/send.ts
 */

/**
 * Generates the plain-text body for the order-cancelled confirmation sent to the orderer.
 * @param ordererName - The orderer's display name
 * @param restaurantName - The restaurant the order was placed at
 * @returns Plain-text email body
 * @called-by lib/email/send.ts
 */
export function orderCancelledOrdText({
  ordererName,
  restaurantName,
}: {
  ordererName: string
  restaurantName: string
}): string {
  return `Hi ${ordererName},

Your order at ${restaurantName} has been cancelled. Your payment authorization has been released and you will not be charged.

— Goober Eats`
}
