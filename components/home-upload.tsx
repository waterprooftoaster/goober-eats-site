'use client'

/**
 * @file home-upload.tsx
 * @description Authenticated home experience: an asymmetric left-aligned hero +
 *   a single tinted upload square. The user picks a cart screenshot; on
 *   "Place order" the file uploads to cart-screenshots via a signed URL, the
 *   path is handed off via sessionStorage, and the user is navigated to
 *   /checkout.
 *   Called by: app/page.tsx (authenticated branch)
 * @dependencies lib/supabase/client.ts, components/ui/{button,surface}
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { createClient } from '@/lib/supabase/client'
import { PENDING_SCREENSHOTS_KEY } from '@/lib/constants'

type Stage = 'idle' | 'selected' | 'uploading' | 'error'

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'] as const
type AllowedExtension = typeof ALLOWED_EXTENSIONS[number]

export default function HomeUpload() {
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
  const showButton = stage !== 'idle'

  return (
    <main
      data-testid="home-page"
      className="mx-auto flex max-w-2xl flex-col gap-10 py-12 sm:py-16"
    >
      <header className="max-w-md">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Order from anywhere on campus.
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Snap your GrubHub cart. We pair you with a student who&rsquo;s got
          swipes &mdash; you pay less than retail, they pocket the rest.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <Surface
          tone="subtle"
          padding="none"
          data-testid="home-dropzone"
          onClick={() => !isUploading && inputRef.current?.click()}
          className="relative aspect-square w-full max-w-md cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-border transition-colors hover:border-foreground/30 motion-reduce:transition-none"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Cart screenshot preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-start justify-end gap-2 p-6 text-muted-foreground">
              <ImagePlus className="h-8 w-8" aria-hidden />
              <span className="text-sm">Tap to upload your cart screenshot.</span>
            </div>
          )}
        </Surface>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          data-testid="home-file-input"
        />

        {showButton && (
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handlePlaceOrder}
            disabled={isUploading}
            className="w-full max-w-md"
            data-testid="home-place-order-button"
          >
            {isUploading ? 'Uploading…' : 'Place order'}
          </Button>
        )}

        {error && (
          <p
            data-testid="home-error-message"
            className="max-w-md text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    </main>
  )
}

// --- Helpers ---

/**
 * Validates and returns the lowercased extension if it is in the allowlist.
 * @param filename - File name as provided by the file picker
 * @returns A lowercased extension or null if unsupported
 * @called-by HomeUpload (handlePlaceOrder)
 */
function extractExtension(filename: string): AllowedExtension | null {
  const idx = filename.lastIndexOf('.')
  if (idx < 0 || idx === filename.length - 1) return null
  const ext = filename.slice(idx + 1).toLowerCase()
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext) ? (ext as AllowedExtension) : null
}
