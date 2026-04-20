/**
 * @file page.tsx
 * @description Checkout page showing the cart summary and embedded Stripe payment form.
 *   Redirects to /cart if the cart is empty or missing.
 *   Called by: Next.js routing (direct navigation to /checkout)
 * @dependencies lib/cart/load.ts, lib/supabase/server.ts, components/checkout-form.tsx
 */

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import { loadCart } from '@/lib/cart/load'
import { CheckoutForm } from '@/components/checkout-form'
import { BackButton } from '@/components/back-button'
import type { LoadedCart } from '@/lib/cart/load'

/**
 * Renders the checkout page with a cart summary and Stripe embedded payment form.
 * @returns Checkout UI; redirects to /cart if cart is empty or not found
 * @called-by Next.js routing (/checkout)
 */
export default async function CheckoutPage() {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  const cookieStore = await cookies()
  const service = createServiceClient()

  let cart: { id: string; eatery_id: string } | null = null
  if (user) {
    const { data } = await service
      .from('carts')
      .select('id, eatery_id')
      .eq('user_id', user.id)
      .maybeSingle()
    cart = data
  } else {
    const sessionId = cookieStore.get('cart_session_id')?.value
    if (sessionId) {
      const { data } = await service
        .from('carts')
        .select('id, eatery_id')
        .eq('session_id', sessionId)
        .maybeSingle()
      cart = data
    }
  }

  if (!cart) redirect('/cart')

  const loaded = await loadCart(service, cart)
  if (loaded.items.length === 0) redirect('/cart')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <BackButton />
          <h1 className="text-xl font-semibold text-gray-900">Checkout</h1>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left: Cart summary */}
          <CartSummary cart={loaded} />

          {/* Right: Payment form */}
          <CheckoutForm isGuest={!user} />
        </div>
      </div>
    </div>
  )
}

// --- Helpers ---

/** Formats a cent amount as a US dollar string (e.g. 500 → "$5.00"). */
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Renders a read-only order summary card with item list and subtotal.
 * @param cart - Fully loaded cart with items, options, and eatery info
 * @called-by CheckoutPage
 */
function CartSummary({ cart }: { cart: LoadedCart }) {
  const subtotal = cart.items.reduce((sum, item) => sum + item.quantity * item.price_cents, 0)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Your order
      </h2>
      <p className="mb-6 text-lg font-semibold text-gray-900">{cart.eatery_name ?? 'Order'}</p>

      <ul className="divide-y divide-gray-100">
        {cart.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between py-3">
            <div>
              <span className="text-sm font-medium text-gray-900">{item.name}</span>
              {item.quantity > 1 && (
                <span className="ml-2 text-xs text-gray-400">×{item.quantity}</span>
              )}
              {item.selected_options.length > 0 && (
                <ul className="mt-0.5 space-y-0.5">
                  {item.selected_options.map((opt) => (
                    <li key={opt.id} className="text-xs text-gray-500">
                      {opt.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <span className="text-sm font-medium text-gray-900">
              {formatCents(item.quantity * item.price_cents)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>{formatCents(subtotal)}</span>
        </div>
        <div className="mt-2 flex justify-between text-base font-semibold text-gray-900">
          <span>Total</span>
          <span>{formatCents(subtotal)}</span>
        </div>
        <p className="mt-2 text-xs text-gray-400">Tips and any extras collected at payment</p>
      </div>
    </div>
  )
}
