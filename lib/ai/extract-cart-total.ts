/**
 * @file extract-cart-total.ts
 * @description Calls Gemini with one or more cart-screenshot byte arrays and
 *   returns the extracted total in integer cents — or null on any failure
 *   (model error, schema violation, sub-floor amount, sanity-ceiling breach).
 *   The function NEVER throws; the caller treats null as "leave the input
 *   empty" with no UI noise.
 *   Called by: app/api/orders/extract-price/route.ts
 * @dependencies ai, lib/ai/gemini-client.ts, lib/ai/prompts/cart-price-zh.ts
 */

import 'server-only'

import { generateText, Output } from 'ai'
import { z } from 'zod'
import { getGeminiModel } from '@/lib/ai/gemini-client'
import { CART_PRICE_PROMPT_ZH } from '@/lib/ai/prompts/cart-price-zh'
import { CART_TOTAL_MIN_CENTS, CART_TOTAL_MAX_CENTS } from '@/lib/constants'

const cartTotalSchema = z.object({
  cents: z.number().int().positive().nullable(),
})

/**
 * Extracts the final cart total from one or more screenshot byte arrays.
 * @param imageBytes - Cart screenshot bytes (PNG/JPEG/WebP/HEIC). Order is
 *   preserved in the prompt; the model treats them as one batched order.
 * @returns Integer cents in [50, 100_000], or null on any failure
 * @called-by app/api/orders/extract-price/route.ts
 */
export async function extractCartTotalCents(imageBytes: Uint8Array[]): Promise<number | null> {
  if (imageBytes.length === 0) return null

  try {
    const { output } = await generateText({
      model: getGeminiModel(),
      system: CART_PRICE_PROMPT_ZH,
      output: Output.object({ schema: cartTotalSchema }),
      messages: [
        {
          role: 'user',
          content: imageBytes.map((bytes) => ({
            type: 'image' as const,
            image: bytes,
          })),
        },
      ],
    })

    const cents = output?.cents ?? null
    if (cents === null) return null
    if (cents < CART_TOTAL_MIN_CENTS) return null
    if (cents > CART_TOTAL_MAX_CENTS) return null
    return cents
  } catch {
    return null
  }
}
