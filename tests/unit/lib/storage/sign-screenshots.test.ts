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
  signCompletionPhotoPath,
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
