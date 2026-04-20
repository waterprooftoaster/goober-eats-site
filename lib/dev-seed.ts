/**
 * @file dev-seed.ts
 * @description Server-only helper that triggers the dev eatery seed RPC in Supabase.
 *   Called by: app/page.tsx (dev mode only)
 * @dependencies lib/supabase/server.ts
 */

import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Triggers the `seed_dev_eateries` Supabase RPC to populate local dev data.
 * @called-by app/page.tsx (dev mode only)
 */
export async function seedDevEateries() {
  const supabase = await createClient()
  const { error } = await supabase.rpc('seed_dev_eateries')
  if (error) {
    console.error('[dev-seed] Failed to seed:', error)
  }
}
