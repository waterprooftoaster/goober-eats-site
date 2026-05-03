/**
 * @file extract-cart-total.test.ts
 * @description Unit tests for `extractCartDetails` — the pure function that
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

import { extractCartDetails } from '@/lib/ai/extract-cart-total'

const FAKE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) // PNG header bytes

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extractCartDetails', () => {
  it('returns cents and eatery when the model returns valid values', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: { cents: 1234, eatery: 'Jasper Kane' } })
    const result = await extractCartDetails([FAKE_BYTES])
    expect(result).toEqual({ cents: 1234, eatery: 'Jasper Kane' })
  })

  it('passes one image content part per input bytes array', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: { cents: 999, eatery: null } })
    await extractCartDetails([FAKE_BYTES, FAKE_BYTES])
    const call = mockGenerateText.mock.calls[0][0]
    const userMessage = call.messages.find((m: { role: string }) => m.role === 'user')
    expect(Array.isArray(userMessage.content)).toBe(true)
    const imageParts = userMessage.content.filter(
      (p: { type: string }) => p.type === 'image',
    )
    expect(imageParts).toHaveLength(2)
  })

  it('returns null cents when the model returns cents: null', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: { cents: null, eatery: 'Upstein' } })
    const result = await extractCartDetails([FAKE_BYTES])
    expect(result).toEqual({ cents: null, eatery: 'Upstein' })
  })

  it('returns null eatery when the model returns eatery: null', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: { cents: 1234, eatery: null } })
    const result = await extractCartDetails([FAKE_BYTES])
    expect(result.cents).toBe(1234)
    expect(result.eatery).toBeNull()
  })

  it('returns null result when generateText throws', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('upstream timeout'))
    const result = await extractCartDetails([FAKE_BYTES])
    expect(result).toEqual({ cents: null, eatery: null })
  })

  it('nulls out cents but preserves eatery when cents exceeds the sanity ceiling', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: { cents: 100_001, eatery: 'Jasper Kane' } })
    const result = await extractCartDetails([FAKE_BYTES])
    expect(result.cents).toBeNull()
    expect(result.eatery).toBe('Jasper Kane')
  })

  it('nulls out cents but preserves eatery when cents falls below the Stripe floor', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: { cents: 49, eatery: 'Flavor Lab' } })
    const result = await extractCartDetails([FAKE_BYTES])
    expect(result.cents).toBeNull()
    expect(result.eatery).toBe('Flavor Lab')
  })

  it('returns null result when the SDK returns a malformed shape', async () => {
    mockGenerateText.mockResolvedValueOnce({ output: { not_cents: 1234 } })
    const result = await extractCartDetails([FAKE_BYTES])
    expect(result).toEqual({ cents: null, eatery: null })
  })

  it('returns null result on empty input array (no images to extract from)', async () => {
    const result = await extractCartDetails([])
    expect(result).toEqual({ cents: null, eatery: null })
    expect(mockGenerateText).not.toHaveBeenCalled()
  })
})
