'use client'

/**
 * @file page.tsx
 * @description Guest screenshot upload page. Guards that a school was selected on
 *   the cover page (reads PENDING_SCHOOL_ID_KEY from sessionStorage; redirects to /
 *   if missing). Mirrors home-upload.tsx but serves unauthenticated orderers coming
 *   from the cover page school selector. Creates an anonymous Supabase session if
 *   none exists, uploads the screenshot via a signed URL, writes the path to
 *   PENDING_SCREENSHOTS_KEY, then navigates to /checkout.
 *   Called by: Next.js routing (/order/new), school-search-pill.tsx (router.push)
 * @dependencies lib/supabase/client.ts, lib/constants.ts,
 *   components/{back-button, ui/button, ui/surface}
 */

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { BackButton } from '@/components/back-button'
import { createClient } from '@/lib/supabase/client'
import { PENDING_SCREENSHOTS_KEY, PENDING_SCHOOL_ID_KEY } from '@/lib/constants'

type Stage = 'idle' | 'selected' | 'uploading' | 'error'

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'] as const
type AllowedExtension = typeof ALLOWED_EXTENSIONS[number]

export default function OrderNewPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)

  // Guard: redirect to cover if no school was selected.
  useEffect(() => {
    const schoolId = sessionStorage.getItem(PENDING_SCHOOL_ID_KEY)
    if (!schoolId) router.replace('/')
  }, [router])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setStage('selected')
    setError(null)
  }

  /**
   * Ensures an anonymous Supabase session exists, obtains a signed upload URL,
   * uploads the file, stores the path in sessionStorage, then navigates to /checkout.
   * @called-by Place order button onClick
   */
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
    <main className="mx-auto flex max-w-2xl flex-col gap-10 py-12 sm:py-16">
      <BackButton />

      <header className="max-w-md">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Upload your cart.
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Screenshot your GrubHub cart and upload it here. A student at your
          school will fill the order using their meal plan.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <Surface
          tone="subtle"
          padding="none"
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
        />

        {showButton && (
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handlePlaceOrder}
            disabled={isUploading}
            className="w-full max-w-md"
          >
            {isUploading ? 'Uploading…' : 'Place order'}
          </Button>
        )}

        {error && (
          <p className="max-w-md text-sm text-destructive">{error}</p>
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
 * @called-by OrderNewPage (handlePlaceOrder)
 */
function extractExtension(filename: string): AllowedExtension | null {
  const idx = filename.lastIndexOf('.')
  if (idx < 0 || idx === filename.length - 1) return null
  const ext = filename.slice(idx + 1).toLowerCase()
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext) ? (ext as AllowedExtension) : null
}
