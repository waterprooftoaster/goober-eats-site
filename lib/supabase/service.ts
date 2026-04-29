/**
 * @file service.ts
 * @description Creates a Supabase service-role client that bypasses RLS; server-side only.
 *   Called by: lib/stripe/transfer.ts, lib/storage/sign-screenshots.ts, lib/api/guest-auth.ts,
 *     app/api/stripe/webhooks/route.ts, app/api/stripe/checkout-session/route.ts,
 *     app/api/orders/[id]/{accept,status}/route.ts, app/api/profile/route.ts,
 *     app/api/cart-screenshots/upload-url/route.ts, app/api/auth/check-email/route.ts,
 *     app/api/guest/{verify-order,orders/[orderId]}/route.ts,
 *     app/order/[orderId]/page.tsx, app/stripe/onboard/complete/page.tsx
 * @dependencies @supabase/supabase-js
 */

import 'server-only'

import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with service-role credentials; bypasses all RLS policies.
 * @returns Supabase client — never use this in client-side code or where RLS should apply
 * @called-by See file-level Called by list
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
