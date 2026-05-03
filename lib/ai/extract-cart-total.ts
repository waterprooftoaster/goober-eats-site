/**
 * @file extract-cart-total.ts
 * @description Calls Gemini with one or more cart-screenshot byte arrays and
 *   returns the extracted total in integer cents plus the matched eatery name
 *   — or null fields on any failure (model error, schema violation,
 *   sub-floor amount, sanity-ceiling breach).
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

const cartDetailsSchema = z.object({
  cents: z.number().int().positive().nullable(),
  eatery: z.string().nullable(),
})

export interface CartDetails {
  cents: number | null
  eatery: string | null
}

const NULL_RESULT: CartDetails = { cents: null, eatery: null }

/**
 * Extracts the final cart total and matched eatery name from one or more
 * screenshot byte arrays.
 * @param imageBytes - Cart screenshot bytes (PNG/JPEG/WebP/HEIC). Order is
 *   preserved in the prompt; the model treats them as one batched order.
 * @returns `{ cents, eatery }` — cents in [50, 100_000] or null; eatery from
 *   the known-eatery list or null.
 * @called-by app/api/orders/extract-price/route.ts
 */
export async function extractCartDetails(imageBytes: Uint8Array[]): Promise<CartDetails> {
  if (imageBytes.length === 0) return NULL_RESULT

  try {
    const { output } = await generateText({
      model: getGeminiModel(),
      system: CART_PRICE_PROMPT_ZH,
      output: Output.object({ schema: cartDetailsSchema }),
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
    const eatery = output?.eatery ?? null
    if (cents !== null && (cents < CART_TOTAL_MIN_CENTS || cents > CART_TOTAL_MAX_CENTS)) {
      return { cents: null, eatery }
    }
    return { cents, eatery }
  } catch {
    return NULL_RESULT
  }
}
