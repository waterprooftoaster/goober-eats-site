'use client'

/**
 * @file page.tsx
 * @description Home page: a single upload square. The user picks a cart screenshot;
 *   on "Place Order" the file uploads to cart-screenshots via a signed URL, then
 *   the path is handed off via sessionStorage and the user is navigated to /checkout.
 *   Called by: Next.js routing (/)
 * @dependencies lib/supabase/client.ts
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { PENDING_SCREENSHOTS_KEY } from '@/lib/constants'

type Stage = 'idle' | 'selected' | 'uploading' | 'error'

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'] as const
type AllowedExtension = typeof ALLOWED_EXTENSIONS[number]

export default function HomePage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setStage('selected')
    setError(null)
  }

  async function handlePlaceOrder() {
    if (!file || stage === 'uploading') return
    setStage('uploading')
    setError(null)

    try {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        const { error: anonErr } = await supabase.auth.signInAnonymously()
        if (anonErr) throw new Error('Could not start a session. Please try again.')
        // Confirm the session token is set before the next server call (the
        // Supabase SDK writes the cookie asynchronously after token exchange).
        const { data: confirmed } = await supabase.auth.getSession()
        if (!confirmed.session) throw new Error('Session did not initialize. Please try again.')
      }

      const ext = extractExtension(file.name)
      if (!ext) throw new Error('File type not supported. Use PNG, JPEG, WebP, HEIC, or HEIF.')

      const signRes = await fetch('/api/cart-screenshots/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_type: file.type, file_extension: ext }),
      })
      if (!signRes.ok) {
        const body = await signRes.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Failed to get upload URL')
      }
      const signed = await signRes.json() as { path: string; signed_url: string }

      const putRes = await fetch(signed.signed_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!putRes.ok) throw new Error('Upload failed. Please try again.')

      sessionStorage.setItem(PENDING_SCREENSHOTS_KEY, JSON.stringify([signed.path]))
      router.push('/checkout')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStage('selected')
    }
  }

  const isUploading = stage === 'uploading'

  return (
    <main data-testid="home-page" className="flex min-h-[80vh] flex-col items-center justify-center px-4 gap-6">
      <div
        className="relative w-80 h-80 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center cursor-pointer overflow-hidden hover:border-gray-400 transition-colors"
        onClick={() => !isUploading && inputRef.current?.click()}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Cart screenshot" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <ImagePlus className="w-12 h-12" />
            <span className="text-sm">Tap to upload cart screenshot</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        data-testid="home-file-input"
      />

      {stage !== 'idle' && (
        <Button
          onClick={handlePlaceOrder}
          disabled={isUploading}
          size="lg"
          className="w-80"
          data-testid="home-place-order-button"
        >
          {isUploading ? 'Uploading…' : 'Place Order'}
        </Button>
      )}

      {error && <p data-testid="home-error-message" className="text-sm text-red-600 text-center max-w-xs">{error}</p>}
    </main>
  )
}

// --- Helpers ---

function extractExtension(filename: string): AllowedExtension | null {
  const idx = filename.lastIndexOf('.')
  if (idx < 0 || idx === filename.length - 1) return null
  const ext = filename.slice(idx + 1).toLowerCase()
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext) ? (ext as AllowedExtension) : null
}
