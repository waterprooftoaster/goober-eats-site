/**
 * @file sign-screenshots.ts
 * @description Server-side helpers that mint short-lived signed URLs for the
 *   private cart-screenshots and completion-photos buckets. Both buckets store
 *   raw paths; consumers (API routes, server components) call these helpers at
 *   the read boundary so the client only ever receives URLs that load.
 *   Called by: app/api/orders/route.ts, app/api/orders/[id]/accept/route.ts,
 *     app/api/orders/[id]/status/route.ts, app/api/swiper/pending/route.ts,
 *     app/swiper/orders/page.tsx, app/api/messages/[orderId]/route.ts,
 *     app/api/messages/[orderId]/upload/route.ts
 * @dependencies lib/supabase/service.ts
 */

import { createServiceClient } from '@/lib/supabase/service'

export const CART_SCREENSHOT_SIGN_TTL_SECONDS = 60 * 60

const CART_SCREENSHOTS_BUCKET = 'cart-screenshots'
const COMPLETION_PHOTOS_BUCKET = 'completion-photos'

/**
 * Mints signed URLs for cart-screenshot storage paths.
 * @param paths - Array of object paths inside the cart-screenshots bucket
 * @returns Array of signed URLs in input order; entries that fail signing are dropped
 * @called-by API routes and server components that surface orders.cart_screenshot_urls
 */
export async function signCartScreenshotPaths(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return []

  const service = createServiceClient()
  const { data, error } = await service.storage
    .from(CART_SCREENSHOTS_BUCKET)
    .createSignedUrls(paths, CART_SCREENSHOT_SIGN_TTL_SECONDS)

  if (error || !data) {
    console.error('signCartScreenshotPaths: failed', { error, count: paths.length })
    return []
  }

  return data
    .map((entry) => entry.signedUrl)
    .filter((url): url is string => typeof url === 'string' && url.length > 0)
}

/**
 * Batched signer for cart-screenshot paths. Returns a path → URL Map so a
 * caller folding paths from many rows into one call can regroup them after
 * signing. One service-client RPC for the whole input.
 * @param paths - Array of object paths inside the cart-screenshots bucket
 * @returns Map keyed by path → signed URL. Paths that fail to sign are absent.
 * @called-by app/api/orders/route.ts, app/api/swiper/pending/route.ts
 */
export async function signCartScreenshotPathsBatch(paths: string[]): Promise<Map<string, string>> {
  return signBatchInBucket(CART_SCREENSHOTS_BUCKET, paths, 'signCartScreenshotPathsBatch')
}

/**
 * Batched signer for completion-photo paths. Replaces the N+1 pattern that
 * called signCompletionPhotoPath per row inside a Promise.all(map).
 * @param paths - Array of object paths inside the completion-photos bucket
 * @returns Map keyed by path → signed URL. Paths that fail to sign are absent.
 * @called-by app/api/messages/[orderId]/route.ts
 */
export async function signCompletionPhotoPathsBatch(paths: string[]): Promise<Map<string, string>> {
  return signBatchInBucket(COMPLETION_PHOTOS_BUCKET, paths, 'signCompletionPhotoPathsBatch')
}

/**
 * Mints a signed URL for a single completion-photo storage path.
 * @param path - Object path inside the completion-photos bucket
 * @returns Signed URL, or null when the input is empty or signing fails
 * @called-by app/api/messages/[orderId]/upload/route.ts (upload responds with one path)
 */
export async function signCompletionPhotoPath(path: string): Promise<string | null> {
  if (!path) return null

  const service = createServiceClient()
  const { data, error } = await service.storage
    .from(COMPLETION_PHOTOS_BUCKET)
    .createSignedUrl(path, CART_SCREENSHOT_SIGN_TTL_SECONDS)

  if (error || !data?.signedUrl) {
    console.error('signCompletionPhotoPath: failed', { error })
    return null
  }

  return data.signedUrl
}

// --- Helpers ---

/**
 * Shared implementation for the batched signers. Single createSignedUrls RPC
 * for the whole list; entries without a signedUrl are dropped from the result.
 * @param bucket - Storage bucket name
 * @param paths - Object paths to sign
 * @param logScope - Used in the error log so failures are attributable to a caller
 * @returns Map of path → signed URL; entries that failed to sign are absent
 */
async function signBatchInBucket(
  bucket: string,
  paths: string[],
  logScope: string
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (paths.length === 0) return out

  const service = createServiceClient()
  const { data, error } = await service.storage
    .from(bucket)
    .createSignedUrls(paths, CART_SCREENSHOT_SIGN_TTL_SECONDS)

  if (error || !data) {
    console.error(`${logScope}: failed`, { error, count: paths.length })
    return out
  }

  for (const entry of data) {
    if (entry.path && entry.signedUrl) {
      out.set(entry.path, entry.signedUrl)
    }
  }
  return out
}
