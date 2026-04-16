'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, X } from 'lucide-react'
import type { LoadedCart } from '@/lib/cart/load'

interface Props {
  initialCart: LoadedCart | null
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function CartPanel({ initialCart }: Props) {
  const router = useRouter()
  const [cart, setCart] = useState<LoadedCart | null>(initialCart)
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Slide-in from right on mount
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    el.style.transform = 'translateX(100%)'
    requestAnimationFrame(() => {
      el.style.transition = 'transform 300ms ease-out'
      el.style.transform = 'translateX(0)'
    })
  }, [])

  async function handleRemove(itemId: string) {
    setRemoving(itemId)
    setRemoveError(null)
    try {
      const res = await fetch(`/api/cart/items/${itemId}`, { method: 'DELETE' })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('cart-updated'))
        setCart((prev) => {
          if (!prev) return null
          const updated = { ...prev, items: prev.items.filter((i) => i.id !== itemId) }
          return updated.items.length === 0 ? null : updated
        })
      } else {
        setRemoveError('Failed to remove item — please try again')
      }
    } catch {
      setRemoveError('Network error — please try again')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <>
      {/* Backdrop — greys everything behind the panel */}
      <button
        type="button"
        aria-label="Close cart"
        onClick={() => router.back()}
        className="fixed inset-0 z-40 w-full bg-black/40 cursor-default"
      />

      {/* Sliding panel — fixed to right edge, full viewport height */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 z-50 flex h-screen w-full md:max-w-sm flex-col bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4">
          <button
            type="button"
            aria-label="Back"
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 text-gray-700" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">
            {cart?.eatery_name ?? 'Your Cart'}
          </h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {removeError && (
            <p className="px-4 py-2 text-center text-xs text-red-600">{removeError}</p>
          )}
          {!cart || cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
              <p className="text-sm text-gray-500">Your cart is empty.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {cart.items.map((item) => (
                <li key={item.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                        <span className="text-xs text-gray-400">×{item.quantity}</span>
                      </div>
                      {item.selected_options.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {item.selected_options.map((opt) => (
                            <li key={opt.id} className="text-xs text-gray-500">
                              {opt.name}
                              {opt.additional_price_cents > 0 && (
                                <span> (+{formatCents(opt.additional_price_cents)})</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCents(item.price_cents * item.quantity)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${item.name}`}
                        disabled={removing === item.id}
                        onClick={() => handleRemove(item.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Checkout button */}
        {cart && cart.items.length > 0 && (
          <div className="border-t border-gray-100 p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold text-gray-900">
                {formatCents(cart.items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0))}
              </span>
            </div>
            <button
              type="button"
              onClick={() => window.location.replace('/checkout')}
              className="block w-full rounded-none bg-black py-3 text-center text-sm font-semibold text-white hover:bg-gray-900"
            >
              Checkout
            </button>
          </div>
        )}
      </div>
    </>
  )
}
