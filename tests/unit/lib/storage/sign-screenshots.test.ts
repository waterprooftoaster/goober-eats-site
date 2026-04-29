/**
 * @file sign-screenshots.test.ts
 * @description Unit tests for the storage signing helpers used by every read
 *   site that surfaces cart-screenshot or completion-photo paths to the client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreateSignedUrls, mockCreateSignedUrl } = vi.hoisted(() => ({
  mockCreateSignedUrls: vi.fn(),
  mockCreateSignedUrl: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUrls: mockCreateSignedUrls,
        createSignedUrl: mockCreateSignedUrl,
      })),
    },
  })),
}))

import {
  signCartScreenshotPaths,
  signCartScreenshotPathsBatch,
  signCompletionPhotoPath,
  signCompletionPhotoPathsBatch,
  CART_SCREENSHOT_SIGN_TTL_SECONDS,
} from '@/lib/storage/sign-screenshots'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('signCartScreenshotPaths', () => {
  it('returns an empty array for an empty input', async () => {
    const result = await signCartScreenshotPaths([])
    expect(result).toEqual([])
    expect(mockCreateSignedUrls).not.toHaveBeenCalled()
  })

  it('signs the input paths against the cart-screenshots bucket and preserves order', async () => {
    mockCreateSignedUrls.mockResolvedValueOnce({
      data: [
        { path: 'pre-checkout/abc/1.jpg', signedUrl: 'https://signed/1', error: null },
        { path: 'pre-checkout/abc/2.jpg', signedUrl: 'https://signed/2', error: null },
      ],
      error: null,
    })

    const result = await signCartScreenshotPaths([
      'pre-checkout/abc/1.jpg',
      'pre-checkout/abc/2.jpg',
    ])

    expect(result).toEqual(['https://signed/1', 'https://signed/2'])
    expect(mockCreateSignedUrls).toHaveBeenCalledWith(
      ['pre-checkout/abc/1.jpg', 'pre-checkout/abc/2.jpg'],
      CART_SCREENSHOT_SIGN_TTL_SECONDS
    )
  })

  it('drops entries whose signed URL is missing rather than emitting empty strings', async () => {
    mockCreateSignedUrls.mockResolvedValueOnce({
      data: [
        { path: 'a.jpg', signedUrl: 'https://signed/a', error: null },
        { path: 'b.jpg', signedUrl: null, error: 'gone' },
      ],
      error: null,
    })

    const result = await signCartScreenshotPaths(['a.jpg', 'b.jpg'])
    expect(result).toEqual(['https://signed/a'])
  })

  it('returns an empty array and does not throw when the storage call fails', async () => {
    mockCreateSignedUrls.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    })

    const result = await signCartScreenshotPaths(['a.jpg'])
    expect(result).toEqual([])
  })
})

describe('signCartScreenshotPathsBatch', () => {
  it('returns an empty Map for empty input and skips the storage call', async () => {
    const result = await signCartScreenshotPathsBatch([])
    expect(result.size).toBe(0)
    expect(mockCreateSignedUrls).not.toHaveBeenCalled()
  })

  it('returns a Map keyed by path → signed URL on success', async () => {
    mockCreateSignedUrls.mockResolvedValueOnce({
      data: [
        { path: 'a.jpg', signedUrl: 'https://signed/a', error: null },
        { path: 'b.jpg', signedUrl: 'https://signed/b', error: null },
      ],
      error: null,
    })
    const result = await signCartScreenshotPathsBatch(['a.jpg', 'b.jpg'])
    expect(result.get('a.jpg')).toBe('https://signed/a')
    expect(result.get('b.jpg')).toBe('https://signed/b')
    expect(result.size).toBe(2)
  })

  it('omits entries whose URL is missing instead of emitting empty values', async () => {
    mockCreateSignedUrls.mockResolvedValueOnce({
      data: [
        { path: 'a.jpg', signedUrl: 'https://signed/a', error: null },
        { path: 'b.jpg', signedUrl: null, error: 'gone' },
      ],
      error: null,
    })
    const result = await signCartScreenshotPathsBatch(['a.jpg', 'b.jpg'])
    expect(result.get('a.jpg')).toBe('https://signed/a')
    expect(result.has('b.jpg')).toBe(false)
  })

  it('returns an empty Map when the storage call fails', async () => {
    mockCreateSignedUrls.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    })
    const result = await signCartScreenshotPathsBatch(['a.jpg'])
    expect(result.size).toBe(0)
  })
})

describe('signCompletionPhotoPathsBatch', () => {
  it('returns an empty Map for empty input', async () => {
    const result = await signCompletionPhotoPathsBatch([])
    expect(result.size).toBe(0)
    expect(mockCreateSignedUrls).not.toHaveBeenCalled()
  })

  it('returns a Map keyed by path → signed URL on success', async () => {
    mockCreateSignedUrls.mockResolvedValueOnce({
      data: [
        { path: 'order-1/p1.jpg', signedUrl: 'https://signed/p1', error: null },
        { path: 'order-1/p2.jpg', signedUrl: 'https://signed/p2', error: null },
      ],
      error: null,
    })
    const result = await signCompletionPhotoPathsBatch(['order-1/p1.jpg', 'order-1/p2.jpg'])
    expect(result.get('order-1/p1.jpg')).toBe('https://signed/p1')
    expect(result.get('order-1/p2.jpg')).toBe('https://signed/p2')
  })
})

describe('signCompletionPhotoPath', () => {
  it('returns null when the path is empty', async () => {
    const result = await signCompletionPhotoPath('')
    expect(result).toBeNull()
    expect(mockCreateSignedUrl).not.toHaveBeenCalled()
  })

  it('signs against the completion-photos bucket', async () => {
    mockCreateSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: 'https://signed/photo' },
      error: null,
    })

    const result = await signCompletionPhotoPath('order-id/uuid.jpg')
    expect(result).toBe('https://signed/photo')
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      'order-id/uuid.jpg',
      CART_SCREENSHOT_SIGN_TTL_SECONDS
    )
  })

  it('returns null when signing fails', async () => {
    mockCreateSignedUrl.mockResolvedValueOnce({
      data: null,
      error: { message: 'boom' },
    })
    const result = await signCompletionPhotoPath('p.jpg')
    expect(result).toBeNull()
  })
})
