/**
 * @file client.ts
 * @description Creates a browser-side Supabase client using the publishable key.
 *   Called by: client components that need direct Supabase access
 * @dependencies @supabase/ssr
 */

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  )
}
