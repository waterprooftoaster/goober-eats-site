'use client'

/**
 * @file order-new-form.tsx
 * @description Client form for creating a new order: uploads cart screenshots, collects total,
 *   then initiates Stripe Embedded Checkout.
 *   Called by: app/order/new/page.tsx
 * @dependencies components/order/screenshot-uploader.tsx, components/order/total-input.tsx,
 *   @stripe/react-stripe-js, lib/types/upload.ts
 */

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { ScreenshotUploader } from '@/components/order/screenshot-uploader'
import { TotalInput } from '@/components/order/total-input'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { UploadFile } from '@/lib/types/upload'

// Singleton outside the component — avoids re-creating on each render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Stage = 'form' | 'uploading' | 'creating-session' | 'checkout' | 'error'

interface OrderNewFormProps {
  isGuest: boolean
}

/**
 * Multi-step order form: fill details → upload screenshots → Stripe Embedded Checkout.
 * @param isGuest - When true shows a guest name field; the name is passed to the checkout session
 * @called-by app/order/new/page.tsx
 */
export function OrderNewForm({ isGuest }: OrderNewFormProps) {
  const [restaurantName, setRestaurantName] = useState('')
  const [files, setFiles] = useState<UploadFile[]>([])
  const [totalCents, setTotalCents] = useState<number | null>(null)
  const [guestName, setGuestName] = useState('')
  const [stage, setStage] = useState<Stage>('form')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const validFiles = files.filter((f) => f.status === 'idle' || f.status === 'done')
  const canSubmit =
    restaurantName.trim().length > 0 &&
    validFiles.length > 0 &&
    totalCents !== null &&
    totalCents >= 1 &&
    stage === 'form'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setStage('uploading')
    setErrorMessage(null)

    const uploadedUrls: string[] = []
    const updatedFiles = files.map((f) => ({ ...f }))

    for (let i = 0; i < updatedFiles.length; i++) {
      const f = updatedFiles[i]
      if (f.status === 'done' && f.url) {
        uploadedUrls.push(f.url)
        continue
      }
      if (f.status !== 'idle') continue

      updatedFiles[i] = { ...f, status: 'uploading' }
      setFiles([...updatedFiles])

      try {
        const signRes = await fetch('/api/cart-screenshots/sign-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: f.file.name, content_type: f.file.type }),
        })
        if (!signRes.ok) {
          const body = await signRes.json().catch(() => ({}))
          throw new Error((body as { error?: string }).error ?? 'Failed to get upload URL')
        }
        const { signed_url, path } = await signRes.json() as { signed_url: string; path: string }

        const putRes = await fetch(signed_url, {
          method: 'PUT',
          body: f.file,
          headers: { 'Content-Type': f.file.type },
        })
        if (!putRes.ok) throw new Error('Failed to upload screenshot')

        updatedFiles[i] = { ...updatedFiles[i], status: 'done', url: path }
        setFiles([...updatedFiles])
        uploadedUrls.push(path)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        updatedFiles[i] = { ...updatedFiles[i], status: 'error', error: msg }
        setFiles([...updatedFiles])
        setErrorMessage(msg)
        setStage('error')
        return
      }
    }

    setStage('creating-session')

    try {
      const body: Record<string, unknown> = {
        restaurant_name: restaurantName.trim(),
        cart_screenshot_urls: uploadedUrls,
        total_cents: totalCents,
      }
      if (isGuest && guestName.trim()) {
        body.guest_name = guestName.trim()
      }

      const res = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Failed to create payment session')
      setClientSecret((json as { clientSecret: string }).clientSecret)
      setStage('checkout')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStage('error')
    }
  }

  if (stage === 'checkout' && clientSecret) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    )
  }

  const isLoading = stage === 'uploading' || stage === 'creating-session'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="restaurant-name" className="block text-sm font-medium text-gray-700 mb-1">
          Restaurant
        </label>
        <Input
          id="restaurant-name"
          type="text"
          placeholder="Restaurant name (e.g. Chipotle)"
          value={restaurantName}
          onChange={(e) => setRestaurantName(e.target.value)}
          maxLength={80}
          disabled={isLoading}
        />
      </div>

      {isGuest && (
        <div>
          <label htmlFor="guest-name" className="block text-sm font-medium text-gray-700 mb-1">
            Your name
          </label>
          <Input
            id="guest-name"
            type="text"
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            maxLength={100}
            disabled={isLoading}
          />
        </div>
      )}

      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">Cart screenshots</p>
        <ScreenshotUploader files={files} onChange={setFiles} disabled={isLoading} />
        <p className="mt-2 text-xs text-gray-500">
          {`Upload the entire cart including the subtotal. If the total you enter doesn't match the subtotal in your screenshots, a swiper probably won't accept your order.`}
        </p>
      </div>

      <TotalInput valueCents={totalCents} onChange={setTotalCents} disabled={isLoading} />

      {stage === 'error' && errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      <Button type="submit" disabled={!canSubmit || isLoading} className="w-full">
        {isLoading
          ? stage === 'uploading' ? 'Uploading screenshots…' : 'Creating session…'
          : 'Place Order'}
      </Button>
    </form>
  )
}
