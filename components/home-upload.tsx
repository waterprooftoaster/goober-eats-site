'use client'

/**
 * @file home-upload.tsx
 * @description Authenticated home experience: an asymmetric left-aligned hero +
 *   a single tinted upload square. The user picks a cart screenshot; on
 *   "Place order" the file uploads to cart-screenshots via a signed URL, the
 *   path is handed off via sessionStorage, and the user is navigated to
 *   /checkout.
 *   Called by: app/page.tsx (authenticated branch)
 * @dependencies lib/supabase/client.ts, lib/image/normalize.ts,
 *   components/ui/{button,surface}
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { DesktopUploadDock } from '@/components/desktop-upload-dock'
import { createClient } from '@/lib/supabase/client'
import { PENDING_SCHOOL_ID_KEY, PENDING_SCREENSHOTS_KEY } from '@/lib/constants'
import { normalizeImage } from '@/lib/image/normalize'

type Stage = 'idle' | 'selected' | 'uploading' | 'error'

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'] as const
type AllowedExtension = typeof ALLOWED_EXTENSIONS[number]

interface HomeUploadProps {
    isSwiper?: boolean
    pendingOrderCount?: number
}

export default function HomeUpload({ isSwiper = false, pendingOrderCount = 0 }: HomeUploadProps) {
    const router = useRouter()
    const inputRef = useRef<HTMLInputElement>(null)
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [stage, setStage] = useState<Stage>('idle')
    const [error, setError] = useState<string | null>(null)

    // School-resolution guard: a guest carries the selection through sessionStorage
    // (set by the cover-page school selector); an authed user has school_id on
    // their profile. Anyone arriving without either is bounced home.
    useEffect(() => {
        if (sessionStorage.getItem(PENDING_SCHOOL_ID_KEY)) return

        let cancelled = false
        void (async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                if (!cancelled) router.replace('/')
                return
            }
            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .maybeSingle()
            if (!cancelled && !profile?.school_id) router.replace('/')
        })()
        return () => { cancelled = true }
    }, [router])

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

            const result = await normalizeImage(file)
            if (!result.ok) {
                setError('Could not read that image. Try saving it as JPEG or PNG.')
                setStage('selected')
                return
            }
            const upload = result.file
            const ext = extractExtension(upload.name)
            if (!ext) throw new Error('File type not supported. Use PNG, JPEG, WebP, HEIC, or HEIF.')

            const signRes = await fetch('/api/cart-screenshots/upload-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content_type: upload.type, file_extension: ext }),
            })
            if (!signRes.ok) {
                const body = await signRes.json().catch(() => ({}))
                throw new Error((body as { error?: string }).error ?? 'Failed to get upload URL')
            }
            const signed = await signRes.json() as { path: string; signed_url: string }

            const putRes = await fetch(signed.signed_url, {
                method: 'PUT',
                body: upload,
                headers: { 'Content-Type': upload.type },
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
                    Order anywhere on campus, 60% off.
                </h1>
                <p className="mt-3 text-base text-muted-foreground">
                    Screenshot a GrubHub cart, at any eatery that takes swipes or dining dollars. We'll pair you with a student with a meal plan.
                </p>
            </header>

            <div className="flex flex-col gap-4">
                {preview ? (
                    <div
                        role="button"
                        tabIndex={0}
                        data-testid="home-dropzone"
                        aria-label="Replace cart screenshot"
                        onClick={() => !isUploading && inputRef.current?.click()}
                        onKeyDown={(e) => {
                            if (!isUploading && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault()
                                inputRef.current?.click()
                            }
                        }}
                        className="cursor-pointer rounded-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={preview}
                            alt="Cart screenshot preview"
                            className="block w-full max-w-md aspect-[9/16] rounded-lg border border-border bg-muted/40 object-contain"
                        />
                    </div>
                ) : (
                    <Surface
                        tone="subtle"
                        padding="none"
                        data-testid="home-dropzone"
                        onClick={() => !isUploading && inputRef.current?.click()}
                        className="relative aspect-square w-full max-w-md cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-border transition-colors hover:border-foreground/30 motion-reduce:transition-none"
                    >
                        <div className="flex h-full flex-col items-start justify-end gap-2 p-6 text-muted-foreground">
                            <ImagePlus className="h-8 w-8" aria-hidden />
                            <span className="text-sm">Tap to upload your cart screenshot.</span>
                        </div>
                    </Surface>
                )}

                <div
                    data-testid="home-upload-tips"
                    className="max-w-md rounded-xl border border-border/60 bg-muted/20 p-4 text-sm"
                >
                    <p className="flex items-center gap-2 font-medium text-foreground">
                        <Lightbulb className="h-4 w-4" aria-hidden />
                        Before you upload, double-check your screenshot.
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-7 text-[13px] leading-relaxed">
                        <li>The eatery name is visible</li>
                        <li>Every item in your cart is shown</li>
                        <li>Item options and customizations are readable</li>
                        <li>The order total is visible</li>
                    </ul>
                </div>

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

            <DesktopUploadDock isSwiper={isSwiper} pendingOrderCount={pendingOrderCount} />
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
