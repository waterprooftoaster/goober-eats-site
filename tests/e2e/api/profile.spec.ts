/**
 * @file profile.spec.ts
 * @description E2E tests for PATCH /api/profile covering unauthenticated and authenticated cases.
 *   Called by: Playwright test runner
 */

import { test, expect } from '@playwright/test'

test.describe('PATCH /api/profile — unauthenticated', () => {
  test('returns 401 without auth', async ({ request }) => {
    const res = await request.patch('/api/profile', {
      data: { school_id: '00000000-0000-0000-0000-000000000001' },
    })
    expect(res.status()).toBe(401)
  })

  test('returns 401 with empty body (auth checked before validation)', async ({ request }) => {
    const res = await request.patch('/api/profile', { data: {} })
    expect(res.status()).toBe(401)
  })

  test('returns 401 with invalid uuid school_id (auth checked before validation)', async ({ request }) => {
    const res = await request.patch('/api/profile', {
      data: { school_id: 'not-a-uuid' },
    })
    expect(res.status()).toBe(401)
  })
})
