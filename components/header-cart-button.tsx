'use client'

/**
 * @file header-cart-button.tsx
 * @description Client cart icon in the header with a live item count badge.
 *   Listens for the 'cart-updated' window event to refresh the count without a page reload.
 *   Called by: components/header.tsx
 */

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'

const iconBtnClass = 'rounded-full p-2 text-white transition-colors hover:bg-white/10'

interface HeaderCartButtonProps {
  itemCount: number
}

/**
 * Renders a cart icon link with a live item count badge; hidden on the /checkout route.
 * @param itemCount - Initial cart item count from the server; updated via 'cart-updated' events
 * @called-by components/header.tsx
 */
export function HeaderCartButton({ itemCount }: HeaderCartButtonProps) {
  const [count, setCount] = useState(itemCount)
  const pathname = usePathname()

  useEffect(() => {
    /**
     * Re-fetches the cart item count from the server after any cart mutation.
     * Called when the 'cart-updated' window event fires.
     * @called-by window 'cart-updated' CustomEvent listener
     */
    async function refreshCount() {
      try {
        const res = await fetch('/api/cart/count')
        if (res.ok) {
          const data = await res.json() as { count: number }
          setCount(data.count)
        }
      } catch {
        // Network error — keep existing count; badge will correct on next navigation
      }
    }
    window.addEventListener('cart-updated', refreshCount)
    return () => window.removeEventListener('cart-updated', refreshCount)
  }, [])

  if (pathname.startsWith('/checkout')) return null
  return (
    <Link href="/cart" className={`${iconBtnClass} relative`} aria-label="Cart">
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
