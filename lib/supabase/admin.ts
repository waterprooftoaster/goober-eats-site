/**
 * @file admin.ts
 * @description Creates a Supabase admin client using service role credentials; bypasses RLS.
 *   Called by: (legacy — prefer lib/supabase/service.ts for new code)
 * @dependencies @supabase/supabase-js
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with service-role credentials; bypasses all RLS policies.
 * @returns Supabase client configured with the service role key
 * @called-by (legacy — prefer createServiceClient from lib/supabase/service.ts for new code)
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
