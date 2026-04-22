'use client'

/**
 * @file order-new-form.tsx
 * @description Client form for creating a new order: uploads cart screenshots,
 *   collects total, then initiates Stripe Embedded Checkout. For guests the
 *   form also collects guest_name + school_id and signs in anonymously before
 *   the upload (the upload-url endpoint requires a Supabase session).
 *   Called by: app/order/new/page.tsx
 * @dependencies components/order/screenshot-uploader.tsx, components/order/total-input.tsx,
 *   @stripe/react-stripe-js, lib/types/upload.ts, lib/supabase/client.ts
 */

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { ScreenshotUploader } from '@/components/order/screenshot-uploader'
import { TotalInput } from '@/components/order/total-input'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient as createBrowserSupabase } from '@/lib/supabase/client'
import type { UploadFile } from '@/lib/types/upload'

// Singleton outside the component — avoids re-creating on each render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Stage = 'form' | 'uploading' | 'creating-session' | 'checkout' | 'error'

export interface SchoolOption {
  id: string
  name: string
}

interface OrderNewFormProps {
  isGuest: boolean
  schools: SchoolOption[]
}

/**
 * Multi-step order form: fill details → upload screenshots → Stripe Embedded Checkout.
 * @param isGuest - When true shows a guest name field + school selector
 * @param schools - Available schools for guest selection (ignored when !isGuest)
 * @called-by app/order/new/page.tsx
 */
export function OrderNewForm({ isGuest, schools }: OrderNewFormProps) {
  const [restaurantName, setRestaurantName] = useState('')
  const [files, setFiles] = useState<UploadFile[]>([])
  const [totalCents, setTotalCents] = useState<number | null>(null)
  const [guestName, setGuestName] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [stage, setStage] = useState<Stage>('form')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null)

  const validFiles = files.filter((f) => f.status === 'idle' || f.status === 'done')
  const canSubmit =
    restaurantName.trim().length > 0 &&
    validFiles.length > 0 &&
    totalCents !== null &&
    totalCents >= 1 &&
    stage === 'form' &&
    (!isGuest || (guestName.trim().length > 0 && schoolId.length > 0))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setStage('uploading')
    setErrorMessage(null)

    // The upload-url endpoint requires a Supabase session. Authenticated users
    // already have one; guests need a one-shot anonymous session.
    if (isGuest) {
      const supabase = createBrowserSupabase()
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        const { error: anonErr } = await supabase.auth.signInAnonymously()
        if (anonErr) {
          setErrorMessage('Could not start an upload session. Please try again.')
          setStage('error')
          return
        }
      }
    }

    const uploadedPaths: string[] = []
    const updatedFiles = files.map((f) => ({ ...f }))
    let sessionId = uploadSessionId

    for (let i = 0; i < updatedFiles.length; i++) {
      const f = updatedFiles[i]
      if (f.status === 'done' && f.url) {
        uploadedPaths.push(f.url)
        continue
      }
      if (f.status !== 'idle') continue

      updatedFiles[i] = { ...f, status: 'uploading' }
      setFiles([...updatedFiles])

      try {
        const fileExtension = extractExtension(f.file.name)
        if (!fileExtension) {
          throw new Error('File extension not supported')
        }
        const signRes = await fetch('/api/cart-screenshots/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content_type: f.file.type,
            file_extension: fileExtension,
            ...(sessionId ? { session_id: sessionId } : {}),
          }),
        })
        if (!signRes.ok) {
          const body = await signRes.json().catch(() => ({}))
          throw new Error((body as { error?: string }).error ?? 'Failed to get upload URL')
        }
        const signed = await signRes.json() as {
          session_id: string
          path: string
          signed_url: string
          token: string
        }

        // Capture and reuse the session_id so all of an order's screenshots
        // land under the same pre-checkout/{session_id}/... prefix.
        if (!sessionId) {
          sessionId = signed.session_id
          setUploadSessionId(sessionId)
        }

        const putRes = await fetch(signed.signed_url, {
          method: 'PUT',
          body: f.file,
          headers: { 'Content-Type': f.file.type },
        })
        if (!putRes.ok) throw new Error('Failed to upload screenshot')

        updatedFiles[i] = { ...updatedFiles[i], status: 'done', url: signed.path }
        setFiles([...updatedFiles])
        uploadedPaths.push(signed.path)
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
        cart_screenshot_paths: uploadedPaths,
        total_cents: totalCents,
      }
      if (isGuest) {
        body.guest_name = guestName.trim()
        body.school_id = schoolId
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
        <>
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

          <div>
            <label htmlFor="school-id" className="block text-sm font-medium text-gray-700 mb-1">
              School
            </label>
            <select
              id="school-id"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              disabled={isLoading || schools.length === 0}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="">{schools.length === 0 ? 'No schools available' : 'Select your school'}</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </>
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

// --- Helpers ---

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'] as const
type AllowedExtension = typeof ALLOWED_EXTENSIONS[number]

/**
 * Extracts the lowercased file extension from a filename if it is in the allowed set.
 * @param filename - Original file name (e.g. "cart.JPG")
 * @returns The extension as a string (e.g. "jpg") or null if missing/unsupported
 */
function extractExtension(filename: string): AllowedExtension | null {
  const idx = filename.lastIndexOf('.')
  if (idx < 0 || idx === filename.length - 1) return null
  const ext = filename.slice(idx + 1).toLowerCase()
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext) ? (ext as AllowedExtension) : null
}
