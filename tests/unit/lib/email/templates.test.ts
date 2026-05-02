/**
 * @file templates.test.ts
 * @description Unit tests for the order email template functions.
 *   Called by: Vitest
 */

import { describe, it, expect } from 'vitest'
import { orderPlacedText } from '@/lib/email/templates/order-placed'
import { orderAcceptedOrdText, orderAcceptedSwipText } from '@/lib/email/templates/order-accepted'
import { orderCompletedOrdText, orderCompletedSwipText } from '@/lib/email/templates/order-completed'
import { orderNewSwipText } from '@/lib/email/templates/order-new'
import { orderCancelledOrdText } from '@/lib/email/templates/order-cancelled'

describe('orderPlacedText', () => {
  it('includes orderer name, restaurant, formatted total, and order ID', () => {
    const text = orderPlacedText({
      ordererName: 'Alex',
      restaurantName: 'Chipotle',
      totalCents: 1234,
      orderId: 'order-abc',
    })
    expect(text).toContain('Alex')
    expect(text).toContain('Chipotle')
    expect(text).toContain('$12.34')
    expect(text).toContain('order-abc')
  })
})

describe('orderAcceptedOrdText', () => {
  it('includes orderer name and restaurant', () => {
    const text = orderAcceptedOrdText({ ordererName: 'Jordan', restaurantName: 'Shake Shack' })
    expect(text).toContain('Jordan')
    expect(text).toContain('Shake Shack')
  })
})

describe('orderAcceptedSwipText', () => {
  it('includes swiper name, restaurant, and formatted total', () => {
    const text = orderAcceptedSwipText({
      swiperName: 'Sam',
      restaurantName: 'Shake Shack',
      totalCents: 999,
    })
    expect(text).toContain('Sam')
    expect(text).toContain('Shake Shack')
    expect(text).toContain('$9.99')
  })
})

describe('orderCompletedOrdText', () => {
  it('includes orderer name and restaurant', () => {
    const text = orderCompletedOrdText({ ordererName: 'Riley', restaurantName: 'Sweetgreen' })
    expect(text).toContain('Riley')
    expect(text).toContain('Sweetgreen')
  })
})

describe('orderCompletedSwipText', () => {
  it('includes swiper name, restaurant, and formatted total', () => {
    const text = orderCompletedSwipText({
      swiperName: 'Dana',
      restaurantName: 'Sweetgreen',
      totalCents: 2050,
    })
    expect(text).toContain('Dana')
    expect(text).toContain('Sweetgreen')
    expect(text).toContain('$20.50')
  })
})

describe('orderNewSwipText', () => {
  it('includes swiper name and restaurant', () => {
    const text = orderNewSwipText({ swiperName: 'Taylor', restaurantName: 'Chick-fil-A' })
    expect(text).toContain('Taylor')
    expect(text).toContain('Chick-fil-A')
  })
})

describe('orderCancelledOrdText', () => {
  it('includes orderer name and restaurant', () => {
    const text = orderCancelledOrdText({ ordererName: 'Morgan', restaurantName: 'Panda Express' })
    expect(text).toContain('Morgan')
    expect(text).toContain('Panda Express')
  })
})
