/**
 * @file test-complaint-ai.ts
 * @description Smoke-test the complaint adjudicator against the real Vercel
 *   AI Gateway using local image fixtures. Run with:
 *     AI_GATEWAY_API_KEY=... npx tsx scripts/test-complaint-ai.ts
 *
 *   Two scenarios:
 *     1. cart.PNG vs receipt.png — should return verdict='deny' (matching).
 *     2. cart.PNG vs hdverticalkirk.jpg — should return verdict='approve_refund'
 *        (completion photo doesn't match the cart at all).
 *
 *   Bypasses the API route + DB; exercises only the AI adjudication call so
 *   we can verify model behavior without seeding orders + payments.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config as dotenvConfig } from 'node:process'

// Load .env.local so AI_GATEWAY_API_KEY is available.
import { config as loadEnv } from 'dotenv'
loadEnv({ path: resolve(process.cwd(), '.env.local') })

void dotenvConfig

import { adjudicateComplaint } from '@/lib/ai/complaint-adjudicator'

const TESTS_DIR = resolve(process.cwd(), 'tests')

function imageDataUrl(filename: string, mime: string): string {
  const bytes = readFileSync(resolve(TESTS_DIR, filename))
  return `data:${mime};base64,${bytes.toString('base64')}`
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error('AI_GATEWAY_API_KEY not set. Aborting.')
    process.exit(1)
  }

  const cart = imageDataUrl('cart.PNG', 'image/png')
  const receipt = imageDataUrl('receipt.png', 'image/png')
  const random = imageDataUrl('hdverticalkirk.jpg', 'image/jpeg')

  console.log('--- Scenario 1: cart vs matching receipt — expect verdict=deny ---')
  const r1 = await adjudicateComplaint({
    cartScreenshotSignedUrls: [cart],
    completionPhotoSignedUrl: receipt,
    category: 'missing_items',
    reasonText:
      'I think some of the items are missing from my order. The receipt has fewer entrees than what I paid for in the cart.',
    orderRestaurantName: 'Chipotle',
    orderTotalCents: 1500,
  })
  console.log(JSON.stringify(r1, null, 2))

  console.log('\n--- Scenario 2: cart vs unrelated image — expect verdict=approve_refund ---')
  const r2 = await adjudicateComplaint({
    cartScreenshotSignedUrls: [cart],
    completionPhotoSignedUrl: random,
    category: 'never_delivered',
    reasonText:
      'My swiper sent a random photo as proof of delivery. I never received the food I paid for.',
    orderRestaurantName: 'Chipotle',
    orderTotalCents: 1500,
  })
  console.log(JSON.stringify(r2, null, 2))

  const summary = {
    scenario1_verdict: r1.verdict,
    scenario1_expected: 'deny',
    scenario1_pass: r1.verdict === 'deny',
    scenario2_verdict: r2.verdict,
    scenario2_expected: 'approve_refund',
    scenario2_pass: r2.verdict === 'approve_refund',
  }
  console.log('\n--- Summary ---')
  console.log(JSON.stringify(summary, null, 2))

  if (!summary.scenario1_pass || !summary.scenario2_pass) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('test-complaint-ai: failed', err)
  process.exit(1)
})
