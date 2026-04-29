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
 * Mints a signed URL for a single completion-photo storage path.
 * @param path - Object path inside the completion-photos bucket
 * @returns Signed URL, or null when the input is empty or signing fails
 * @called-by app/api/messages/[orderId]/upload/route.ts, app/api/messages/[orderId]/route.ts
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
