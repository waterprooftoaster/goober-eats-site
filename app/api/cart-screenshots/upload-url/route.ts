/**
 * @file route.ts
 * @description POST endpoint that mints a short-lived signed upload URL into
 *   the `cart-screenshots` bucket scoped to a server-generated path inside
 *   `pre-checkout/{session_id}/...`. The orderer cannot upload into someone
 *   else's path because the path is chosen here (not by the client) and the
 *   bucket has no INSERT RLS policy — direct client writes are blocked.
 *   Called by: pre-checkout cart-screenshot uploader (auth or anonymous user)
 * @dependencies lib/supabase/server.ts, lib/supabase/service.ts, lib/api/helpers.ts, lib/types/api.ts
 */

import { NextRequest } from 'next/server'
import { randomBytes, randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { screenshotUploadUrlSchema } from '@/lib/types/api'

const BUCKET = 'cart-screenshots'

/**
 * Issues a single-use signed upload URL into the cart-screenshots bucket for the calling user.
 * @returns JSON { session_id, path, signed_url, token }; 400 on invalid body, 401 unauthenticated, 500 on storage error
 * @called-by pre-checkout cart-screenshot uploader
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  // Auth required (anonymous Supabase sessions count via signInAnonymously()).
  // Without auth there is nothing to bind the upload to for audit purposes.
  if (!user) return apiError('Unauthorized', 401)

  const body = await request.json()
  const parsed = screenshotUploadUrlSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400)
  }
  const { session_id, file_extension } = parsed.data

  const sessionId = session_id ?? generateSessionId()
  const path = `pre-checkout/${sessionId}/${randomUUID()}.${file_extension}`

  const service = createServiceClient()
  const { data, error } = await service.storage
    .from(BUCKET)
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('cart-screenshots/upload-url: storage error', error)
    return apiError('Failed to mint upload URL', 500)
  }

  return apiSuccess({
    session_id: sessionId,
    path,
    signed_url: data.signedUrl,
    token: data.token,
  })
}

// --- Helpers ---

/**
 * Generates a 10-char URL-safe session id (≈60 bits of entropy).
 * Matches the SESSION_ID_RE regex in lib/types/api.ts.
 * @returns 10-char base64url session id
 */
function generateSessionId(): string {
  // 10 base64url chars carry 60 bits — collision probability for the few
  // hundred concurrent pre-checkout sessions per minute is negligible.
  return randomBytes(8).toString('base64url').slice(0, 10)
}
