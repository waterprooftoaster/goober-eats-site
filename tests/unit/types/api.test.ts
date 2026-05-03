/**
 * @file api.test.ts
 * @description Zod schema boundary tests for lib/types/api.ts. Focuses on the
 *   post-pivot schemas (createCheckoutSchema, screenshotUploadUrlSchema) that
 *   protect the new GrubHub-screenshot flow from malformed input.
 * @dependencies vitest, @/lib/types/api
 */

import { describe, it, expect } from 'vitest'
import {
  createCheckoutSchema,
  screenshotUploadUrlSchema,
  updateOrderStatusSchema,
  sendMessageSchema,
  updateProfileSchema,
} from '@/lib/types/api'

const VALID_UUID = '00000000-0000-4000-8000-000000000001'
const VALID_SESSION_ID = 'abc123XYZ_'
const VALID_PATH_PNG = `pre-checkout/${VALID_SESSION_ID}/${VALID_UUID}.png`
const VALID_PATH_HEIC = `pre-checkout/${VALID_SESSION_ID}/${VALID_UUID}.heic`

describe('createCheckoutSchema', () => {
  const baseValid = {
    restaurant_name: 'Chipotle',
    cart_screenshot_paths: [VALID_PATH_PNG],
    subtotal_cents: 1500,
  }

  it('accepts a minimal valid payload', () => {
    expect(createCheckoutSchema.safeParse(baseValid).success).toBe(true)
  })

  it('accepts 5 screenshots', () => {
    const r = createCheckoutSchema.safeParse({
      ...baseValid,
      cart_screenshot_paths: Array(5).fill(VALID_PATH_PNG),
    })
    expect(r.success).toBe(true)
  })

  it('rejects 6+ screenshots', () => {
    const r = createCheckoutSchema.safeParse({
      ...baseValid,
      cart_screenshot_paths: Array(6).fill(VALID_PATH_PNG),
    })
    expect(r.success).toBe(false)
  })

  it('rejects empty screenshot array', () => {
    const r = createCheckoutSchema.safeParse({ ...baseValid, cart_screenshot_paths: [] })
    expect(r.success).toBe(false)
  })

  it('rejects screenshot paths outside pre-checkout/ prefix', () => {
    const r = createCheckoutSchema.safeParse({
      ...baseValid,
      cart_screenshot_paths: [`orders/${VALID_UUID}/${VALID_UUID}.png`],
    })
    expect(r.success).toBe(false)
  })

  it('rejects path-traversal attempts', () => {
    const r = createCheckoutSchema.safeParse({
      ...baseValid,
      cart_screenshot_paths: [`pre-checkout/../${VALID_SESSION_ID}/${VALID_UUID}.png`],
    })
    expect(r.success).toBe(false)
  })

  it('rejects unsupported file extension', () => {
    const r = createCheckoutSchema.safeParse({
      ...baseValid,
      cart_screenshot_paths: [`pre-checkout/${VALID_SESSION_ID}/${VALID_UUID}.gif`],
    })
    expect(r.success).toBe(false)
  })

  it('accepts heic and heif extensions', () => {
    expect(
      createCheckoutSchema.safeParse({ ...baseValid, cart_screenshot_paths: [VALID_PATH_HEIC] }).success
    ).toBe(true)
  })

  it('rejects subtotal_cents below Stripe minimum (50)', () => {
    const r = createCheckoutSchema.safeParse({ ...baseValid, subtotal_cents: 49 })
    expect(r.success).toBe(false)
  })

  it('accepts subtotal_cents up to CART_TOTAL_MAX_CENTS (100_000 = $1000)', () => {
    expect(
      createCheckoutSchema.safeParse({ ...baseValid, subtotal_cents: 100_000 }).success
    ).toBe(true)
    expect(
      createCheckoutSchema.safeParse({ ...baseValid, subtotal_cents: 50_001 }).success
    ).toBe(true)
  })

  it('rejects subtotal_cents above CART_TOTAL_MAX_CENTS — guards outsized auth holds', () => {
    expect(
      createCheckoutSchema.safeParse({ ...baseValid, subtotal_cents: 100_001 }).success
    ).toBe(false)
    expect(
      createCheckoutSchema.safeParse({ ...baseValid, subtotal_cents: 10_000_000 }).success
    ).toBe(false)
  })

  it('rejects non-integer subtotal_cents', () => {
    const r = createCheckoutSchema.safeParse({ ...baseValid, subtotal_cents: 1500.5 })
    expect(r.success).toBe(false)
  })

  it('rejects empty restaurant_name after trim', () => {
    const r = createCheckoutSchema.safeParse({ ...baseValid, restaurant_name: '   ' })
    expect(r.success).toBe(false)
  })

  it('rejects restaurant_name over 80 chars', () => {
    const r = createCheckoutSchema.safeParse({ ...baseValid, restaurant_name: 'a'.repeat(81) })
    expect(r.success).toBe(false)
  })

  it('trims whitespace from restaurant_name', () => {
    const r = createCheckoutSchema.safeParse({ ...baseValid, restaurant_name: '  Chipotle  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.restaurant_name).toBe('Chipotle')
  })

  it('accepts optional guest_name', () => {
    const r = createCheckoutSchema.safeParse({ ...baseValid, guest_name: 'Alex Smith' })
    expect(r.success).toBe(true)
  })

  it('accepts optional school_id as UUID', () => {
    const r = createCheckoutSchema.safeParse({ ...baseValid, school_id: VALID_UUID })
    expect(r.success).toBe(true)
  })

  it('rejects non-UUID school_id', () => {
    const r = createCheckoutSchema.safeParse({ ...baseValid, school_id: 'nyu' })
    expect(r.success).toBe(false)
  })
})

describe('screenshotUploadUrlSchema', () => {
  it('accepts content_type + file_extension without session_id', () => {
    const r = screenshotUploadUrlSchema.safeParse({
      content_type: 'image/png',
      file_extension: 'png',
    })
    expect(r.success).toBe(true)
  })

  it('accepts all valid MIME types', () => {
    for (const ct of ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']) {
      const r = screenshotUploadUrlSchema.safeParse({ content_type: ct, file_extension: 'png' })
      expect(r.success).toBe(true)
    }
  })

  it('rejects unsupported content_type (e.g. image/gif)', () => {
    const r = screenshotUploadUrlSchema.safeParse({
      content_type: 'image/gif',
      file_extension: 'png',
    })
    expect(r.success).toBe(false)
  })

  it('rejects unsupported file_extension', () => {
    const r = screenshotUploadUrlSchema.safeParse({
      content_type: 'image/png',
      file_extension: 'gif',
    })
    expect(r.success).toBe(false)
  })

  it('accepts valid 10-char session_id', () => {
    const r = screenshotUploadUrlSchema.safeParse({
      session_id: VALID_SESSION_ID,
      content_type: 'image/png',
      file_extension: 'png',
    })
    expect(r.success).toBe(true)
  })

  it('rejects session_id of wrong length', () => {
    expect(
      screenshotUploadUrlSchema.safeParse({
        session_id: 'short',
        content_type: 'image/png',
        file_extension: 'png',
      }).success
    ).toBe(false)
    expect(
      screenshotUploadUrlSchema.safeParse({
        session_id: 'a'.repeat(20),
        content_type: 'image/png',
        file_extension: 'png',
      }).success
    ).toBe(false)
  })

  it('rejects session_id with disallowed characters', () => {
    const r = screenshotUploadUrlSchema.safeParse({
      session_id: 'abc/123xyz',
      content_type: 'image/png',
      file_extension: 'png',
    })
    expect(r.success).toBe(false)
  })
})

describe('unchanged schemas — regression guard', () => {
  it('updateOrderStatusSchema still accepts open/completed/cancelled', () => {
    for (const status of ['open', 'completed', 'cancelled']) {
      expect(updateOrderStatusSchema.safeParse({ status }).success).toBe(true)
    }
    expect(updateOrderStatusSchema.safeParse({ status: 'in_progress' }).success).toBe(false)
  })

  it('sendMessageSchema still defaults message_type to text', () => {
    const r = sendMessageSchema.safeParse({ order_id: VALID_UUID, body: 'hi' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.message_type).toBe('text')
  })

  it('sendMessageSchema does NOT allow completion_photo via body', () => {
    const r = sendMessageSchema.safeParse({
      order_id: VALID_UUID,
      body: 'x',
      message_type: 'completion_photo',
    })
    expect(r.success).toBe(false)
  })

  it('sendMessageSchema accepts an optional UUID temp_id', () => {
    const r = sendMessageSchema.safeParse({
      order_id: VALID_UUID,
      body: 'hi',
      temp_id: VALID_UUID,
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.temp_id).toBe(VALID_UUID)
  })

  it('sendMessageSchema rejects a non-UUID temp_id', () => {
    const r = sendMessageSchema.safeParse({
      order_id: VALID_UUID,
      body: 'hi',
      temp_id: 'not-a-uuid',
    })
    expect(r.success).toBe(false)
  })

  it('updateProfileSchema requires at least one field', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false)
    expect(updateProfileSchema.safeParse({ is_swiper: true }).success).toBe(true)
  })
})
