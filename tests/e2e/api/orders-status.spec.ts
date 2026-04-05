import { test, expect } from '@playwright/test'

const FAKE_ID = '00000000-0000-4000-8000-000000000001'

test.describe('Order status/pay API (unauthenticated)', () => {
  test('PATCH /api/orders/{id}/accept returns 401 without auth', async ({ request }) => {
    const res = await request.patch(`/api/orders/${FAKE_ID}/accept`)
    expect(res.status()).toBe(401)
  })

  test('PATCH /api/orders/{id}/status returns 401 without auth', async ({ request }) => {
    const res = await request.patch(`/api/orders/${FAKE_ID}/status`, {
      data: { status: 'completed' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/orders/{id}/pay returns 401 without auth', async ({ request }) => {
    const res = await request.post(`/api/orders/${FAKE_ID}/pay`)
    expect(res.status()).toBe(401)
  })
})
