/**
 * @file api.ts
 * @description Zod schemas and inferred types for all API request bodies.
 *   Called by: all app/api/ route handlers that parse request bodies
 * @dependencies zod
 */

import { z } from 'zod'

// Pre-checkout screenshot session id: 10-char nanoid. Emitted by
// /api/cart-screenshots/upload-url; echoed back by the client on subsequent
// uploads and the final checkout submission.
const SESSION_ID_RE = /^[A-Za-z0-9_-]{10}$/

// Path layout: pre-checkout/{session_id}/{uuid}.{ext}
// Anchors enforced so Stripe metadata cannot carry smuggled paths (e.g.
// "../orders/foo/..") into the webhook.
const SCREENSHOT_PATH_RE =
  /^pre-checkout\/[A-Za-z0-9_-]{10}\/[0-9a-fA-F-]{36}\.(?:png|jpg|jpeg|webp|heic|heif)$/

const SCREENSHOT_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

const SCREENSHOT_FILE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'webp',
  'heic',
  'heif',
] as const

// Only statuses a client can supply via the status endpoint:
// 'in_progress' is set by the accept endpoint; 'open' is used for swiper un-accept.
export const updateOrderStatusSchema = z.object({
  status: z.enum(['completed', 'cancelled', 'open']),
})

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>

export const sendMessageSchema = z.object({
  order_id: z.string().uuid(),
  body: z.string().min(1).max(1000),
  // completion_photo messages are created via the upload endpoint, not here.
  message_type: z.enum(['text', 'system']).default('text'),
  // Client-supplied id for optimistic-UI dedupe; server echoes it back so the
  // realtime INSERT payload carries it. UUID-bounded to prevent arbitrary input.
  temp_id: z.string().uuid().optional(),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>

// Body for POST /api/stripe/checkout-session.
//   - restaurant_name is a free-text GrubHub venue name.
//   - cart_screenshot_paths are bucket paths minted by
//     /api/cart-screenshots/upload-url, 1..5 entries.
//   - subtotal_cents is the GrubHub subtotal the orderer enters; the orderer
//     is charged 60% of this per lib/pricing.ts:computeSplit. 50c minimum is
//     Stripe's floor. No upper bound.
//   - school_id is only required for guests; for authenticated users it is
//     derived server-side from the profile and any body value is ignored.
export const createCheckoutSchema = z.object({
  restaurant_name: z.string().trim().min(1).max(80),
  cart_screenshot_paths: z.array(z.string().regex(SCREENSHOT_PATH_RE)).min(1).max(5),
  subtotal_cents: z.number().int().min(50),
  school_id: z.string().uuid().optional(),
  guest_name: z.string().trim().min(1).max(100).optional(),
})

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>

// Body for POST /api/cart-screenshots/upload-url.
// The endpoint picks the object path and hands back a short-lived signed
// upload URL; the caller cannot forge arbitrary paths.
export const screenshotUploadUrlSchema = z.object({
  session_id: z.string().regex(SESSION_ID_RE).optional(),
  content_type: z.enum(SCREENSHOT_CONTENT_TYPES),
  file_extension: z.enum(SCREENSHOT_FILE_EXTENSIONS),
})

export type ScreenshotUploadUrlInput = z.infer<typeof screenshotUploadUrlSchema>

// Body for POST /api/cart-screenshots/sign.
// The orderer cannot read pre-payment paths via Storage RLS (no orders row
// exists yet), so this server-side endpoint mints signed URLs for the
// /checkout preview using the service client.
export const screenshotSignSchema = z.object({
  paths: z.array(z.string().regex(SCREENSHOT_PATH_RE)).min(1).max(5),
})

export type ScreenshotSignInput = z.infer<typeof screenshotSignSchema>

export const updateProfileSchema = z
  .object({
    school_id: z.string().uuid().optional(),
    is_swiper: z.boolean().optional(),
  })
  .refine((d) => d.school_id !== undefined || d.is_swiper !== undefined, {
    message: 'At least one field must be provided',
  })

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

// Body for the forgot-password server action. Email is the only field; the
// redirect URL is built server-side from NEXT_PUBLIC_URL so the client cannot
// influence where the recovery link points.
export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

// Body for the reset-password server action. Minimum length matches the
// supabase config.toml `minimum_password_length` floor; the project policy
// asks for >=8 specifically on reset.
export const resetPasswordSchema = z.object({
  password: z.string().min(8),
})

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
