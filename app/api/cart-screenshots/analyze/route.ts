/**
 * @file route.ts
 * @description POST endpoint that calls Gemini Vision via the Vercel AI Gateway
 *   to extract the cart total from an uploaded screenshot path and return it
 *   as integer cents. Returns { cents: null } (200) on any non-fatal failure
 *   (gateway unavailable, unrecognizable image) so callers never crash.
 *   Called by: components/home-upload.tsx (handlePlaceOrder)
 * @dependencies ai, lib/supabase/server.ts, lib/storage/sign-screenshots.ts,
 *   lib/api/helpers.ts
 */

import { generateText } from 'ai'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { signCartScreenshotPaths } from '@/lib/storage/sign-screenshots'

/**
 * Extracts the cart total from a cart-screenshot storage path using Gemini
 * Vision routed through the Vercel AI Gateway (AI_GATEWAY_API_KEY).
 * @returns JSON { cents: number | null }; 401 if unauthenticated, 400 if bad body
 * @called-by components/home-upload.tsx
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) return apiError('Unauthorized', 401)

  const body = await request.json().catch(() => null)
  if (!body || typeof body.path !== 'string' || !body.path) {
    return apiError('path is required', 400)
  }

  const [signedUrl] = await signCartScreenshotPaths([body.path])
  if (!signedUrl) return apiSuccess({ cents: null })

  const imgRes = await fetch(signedUrl)
  if (!imgRes.ok) return apiSuccess({ cents: null })

  const buffer = await imgRes.arrayBuffer()
  const mimeType = (imgRes.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim()

  try {
    const { text } = await generateText({
      model: 'google/gemini-2.0-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'This is a GrubHub cart screenshot. What is the order total shown? Reply with only the numeric dollar amount (e.g. "12.50"), no currency symbol, no other text.',
            },
            {
              type: 'image',
              image: Buffer.from(buffer),
              mediaType: mimeType,
            },
          ],
        },
      ],
    })

    const match = text.match(/\d+\.?\d{0,2}/)
    if (!match) return apiSuccess({ cents: null })

    const cents = Math.round(parseFloat(match[0]) * 100)
    return apiSuccess({ cents: isNaN(cents) || cents <= 0 ? null : cents })
  } catch {
    return apiSuccess({ cents: null })
  }
}
