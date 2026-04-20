/**
 * @file service.ts
 * @description Creates a Supabase service-role client that bypasses RLS; server-side only.
 *   Called by: lib/stripe/transfer.ts, lib/cart/load.ts, lib/chat/system-messages.ts, app/api/stripe/webhooks/route.ts
 * @dependencies @supabase/supabase-js
 */

import 'server-only'

import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with service-role credentials; bypasses all RLS policies.
 * @returns Supabase client — never use this in client-side code or where RLS should apply
 * @called-by lib/stripe/transfer.ts, lib/cart/load.ts, lib/chat/system-messages.ts, app/api/stripe/webhooks/route.ts
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}
