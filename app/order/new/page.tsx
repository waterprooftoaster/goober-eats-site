/**
 * @file page.tsx
 * @description Server component wrapper for the new order creation page.
 *   Checks auth and passes isGuest to OrderNewForm. Both guest and authenticated users can access.
 *   Called by: Next.js routing (direct navigation to /order/new)
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts, app/order/new/order-new-form.tsx
 */

import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import { OrderNewForm } from './order-new-form'

/**
 * Renders the order creation page with an auth-aware form.
 * @returns Page with OrderNewForm; isGuest=true for unauthenticated visitors
 * @called-by Next.js routing (/order/new)
 */
export default async function OrderNewPage() {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Place an Order</h1>
        <OrderNewForm isGuest={!user} />
      </div>
    </main>
  )
}
