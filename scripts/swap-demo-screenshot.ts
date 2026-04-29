/**
 * @file swap-demo-screenshot.ts
 * @description One-off helper for visual verification: deletes all open
 *   orders in the local DB then re-seeds the demo Chipotle order with a
 *   tall phone-screenshot-shaped mock from /tmp/tall-cart-mock.png.
 *   Idempotent.
 *   Called by: manual run during image-refactor verification only
 * @dependencies @supabase/supabase-js
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { randomBytes, randomUUID } from 'crypto'
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY')
  }
  const supabase = createClient(supabaseUrl, serviceKey)

  // Clean stale open orders so the queue has only the seeded demo order
  await supabase.from('orders').delete().eq('status', 'open')

  // Re-seed the demo order with our tall mock
  const { data: orderer } = await supabase
    .from('profiles')
    .select('id, school_id')
    .eq('email', 'nyuuser@test.edu')
    .single()
  if (!orderer) throw new Error('Demo orderer profile missing — run seed.ts first')

  const buf = readFileSync('/tmp/tall-cart-mock.png')
  const sessionId = randomBytes(8).toString('base64url').slice(0, 10)
  const cartPath = `pre-checkout/${sessionId}/${randomUUID()}.png`
  await supabase.storage.from('cart-screenshots').upload(cartPath, buf, {
    contentType: 'image/png',
    upsert: true,
  })

  const seedPiId = 'pi_seed_demo_chipotle'
  await supabase.from('orders').delete().eq('stripe_payment_intent_id', seedPiId)

  const { error: insErr } = await supabase.from('orders').insert({
    orderer_id: orderer.id,
    school_id: orderer.school_id,
    restaurant_name: 'Chipotle',
    cart_screenshot_urls: [cartPath],
    stripe_payment_intent_id: seedPiId,
    subtotal_cents: 2500,
    total_cents: 1500,
    status: 'open',
  })
  if (insErr) throw new Error(`Order insert failed: ${insErr.message}`)

  console.log(`Reseeded queue with single Chipotle order at ${cartPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
