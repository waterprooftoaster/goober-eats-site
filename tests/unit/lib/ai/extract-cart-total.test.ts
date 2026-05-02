/**
 * @file extract-cart-total.test.ts
 * @description Unit tests for `extractCartTotalCents` — the pure function that
 *   wraps the AI SDK call, applies sanity bounds, and never throws. Mocks
 *   `generateText` from `ai` directly via `vi.hoisted` so no network call
 *   leaves the test boundary.
 *   Called by: vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// extract-cart-total imports 'server-only', which throws under vitest's jsdom env.
vi.mock('server-only', () => ({}))

const { mockGenerateText } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
}))

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return {
    ...actual,
    generateText: mockGenerateText,
  }
})

vi.mock('@/lib/ai/gemini-client', () => ({
  getGeminiModel: () => ({ __mockModel: true }),
}))

import { extractCartTotalCents } from '@/lib/ai/extract-cart-total'

const FAKE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) // PNG header bytes

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extractCartTotalCents', () => {
  it('returns integer cents when the model returns a positive int', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: { cents: 1234 } })
    const result = await extractCartTotalCents([FAKE_BYTES])
    expect(result).toBe(1234)
  })

  it('passes one image content part per input bytes array', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: { cents: 999 } })
    await extractCartTotalCents([FAKE_BYTES, FAKE_BYTES])
    const call = mockGenerateText.mock.calls[0][0]
    const userMessage = call.messages.find((m: { role: string }) => m.role === 'user')
    expect(Array.isArray(userMessage.content)).toBe(true)
    const imageParts = userMessage.content.filter(
      (p: { type: string }) => p.type === 'image',
    )
    expect(imageParts).toHaveLength(2)
  })

  it('returns null when the model returns cents: null', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: { cents: null } })
    const result = await extractCartTotalCents([FAKE_BYTES])
    expect(result).toBeNull()
  })

  it('returns null when generateText throws', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('upstream timeout'))
    const result = await extractCartTotalCents([FAKE_BYTES])
    expect(result).toBeNull()
  })

  it('returns null when cents exceeds the sanity ceiling ($1000 = 100_000)', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: { cents: 100_001 } })
    const result = await extractCartTotalCents([FAKE_BYTES])
    expect(result).toBeNull()
  })

  it('returns null when cents falls below the Stripe floor ($0.50 = 50)', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: { cents: 49 } })
    const result = await extractCartTotalCents([FAKE_BYTES])
    expect(result).toBeNull()
  })

  it('returns null when the SDK returns a malformed shape', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: { not_cents: 1234 } })
    const result = await extractCartTotalCents([FAKE_BYTES])
    expect(result).toBeNull()
  })

  it('returns null on empty input array (no images to extract from)', async () => {
    const result = await extractCartTotalCents([])
    expect(result).toBeNull()
    expect(mockGenerateText).not.toHaveBeenCalled()
  })
})
