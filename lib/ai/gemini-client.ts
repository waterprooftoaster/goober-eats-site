/**
 * @file gemini-client.ts
 * @description Returns a configured Gemini model — routed through the Vercel
 *   AI Gateway when AI_GATEWAY_API_KEY is set, otherwise direct via the
 *   @ai-sdk/google provider (reads GOOGLE_GENERATIVE_AI_API_KEY).
 *   Called by: lib/ai/extract-cart-total.ts
 * @dependencies ai, @ai-sdk/google
 */

import 'server-only'

import { gateway, type LanguageModel } from 'ai'
import { google } from '@ai-sdk/google'

const MODEL_ID = 'gemini-2.5-flash'

/**
 * Returns a Gemini language-model instance, routed through the Vercel AI
 * Gateway when AI_GATEWAY_API_KEY is set; otherwise direct provider.
 * @returns AI SDK LanguageModel for `gemini-2.5-flash`
 * @called-by lib/ai/extract-cart-total.ts
 */
export function getGeminiModel(): LanguageModel {
  if (process.env.AI_GATEWAY_API_KEY) {
    return gateway(`google/${MODEL_ID}`)
  }
  return google(MODEL_ID)
}
