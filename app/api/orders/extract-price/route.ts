/**
 * @file route.ts
 * @description POST endpoint that downloads cart-screenshot bytes from the
 *   `cart-screenshots` bucket (using the service client because no orders
 *   row exists yet, so RLS can't scope reads — same justification as
 *   /api/cart-screenshots/sign) and asks Gemini for the cart total. Always
 *   returns 200 with `{ cents: number | null }`; never surfaces an AI error
 *   to the client.
 *   Called by: components/home-upload.tsx (kicked off pre-navigation)
 * @dependencies lib/supabase/server.ts, lib/supabase/service.ts,
 *   lib/api/helpers.ts, lib/types/api.ts, lib/ai/extract-cart-total.ts
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { extractPriceSchema } from '@/lib/types/api'
import { extractCartTotalCents } from '@/lib/ai/extract-cart-total'

const CART_SCREENSHOTS_BUCKET = 'cart-screenshots'

/**
 * Downloads the screenshots, asks Gemini for the total, and returns it.
 * @returns JSON { cents: number | null }; 401 unauthenticated, 400 invalid body
 * @called-by components/home-upload.tsx (handlePlaceOrder)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  // Anonymous Supabase sessions count, matching /api/cart-screenshots/sign.
  // Path layout already prevents arbitrary access (random uuid + nanoid
  // session id under pre-checkout/) so combined with auth this is sufficient.
  if (!user) return apiError('Unauthorized', 401)

  const body = await request.json().catch(() => null)
  const parsed = extractPriceSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400)
  }

  const bytes = await downloadAll(parsed.data.paths)
  if (bytes === null) return apiSuccess({ cents: null })

  const cents = await extractCartTotalCents(bytes)
  return apiSuccess({ cents })
}

// --- Helpers ---

/**
 * Downloads each path from the cart-screenshots bucket via the service
 * client in parallel. Returns null if any download fails — partial input
 * would only produce a confused inference, which the prompt itself can't
 * disambiguate.
 * @param paths - Validated cart-screenshot paths (zod-checked)
 * @returns Array of byte arrays in input order, or null on any error
 * @called-by POST handler
 */
async function downloadAll(paths: string[]): Promise<Uint8Array[] | null> {
  const service = createServiceClient()
  const results = await Promise.all(
    paths.map((path) =>
      service.storage.from(CART_SCREENSHOTS_BUCKET).download(path),
    ),
  )
  if (results.some(({ data, error }) => error || !data)) return null
  const buffers = await Promise.all(
    results.map(({ data }) => data!.arrayBuffer()),
  )
  return buffers.map((buf) => new Uint8Array(buf))
}
