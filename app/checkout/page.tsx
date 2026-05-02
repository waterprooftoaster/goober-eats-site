'use client'

/**
 * @file page.tsx
 * @description Checkout page: signed-URL cart preview + auth-branched form
 *   (guest gets a name field; authed-with-profile does not) → Stripe Embedded
 *   Checkout. Reads screenshot paths from sessionStorage; redirects home if
 *   empty. Errors render inline above the Pay button.
 *   Called by: Next.js routing (/checkout), app/page.tsx (router.push)
 * @dependencies @stripe/react-stripe-js, lib/supabase/client.ts,
 *   components/{back-button, ui/button, ui/input, ui/surface, ui/skeleton}
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { Skeleton } from '@/components/ui/skeleton'
import { BackButton } from '@/components/back-button'
import { CartScreenshot, CartScreenshotSkeleton } from '@/components/order/cart-screenshot'
import { createClient } from '@/lib/supabase/client'
import {
    PENDING_SCREENSHOTS_KEY,
    PENDING_SCHOOL_ID_KEY,
    PENDING_SUBTOTAL_CENTS_KEY,
    CART_TOTAL_MIN_CENTS,
    CART_TOTAL_MAX_CENTS,
} from '@/lib/constants'
import { computeSplit } from '@/lib/pricing'
import {
    clearPendingSubtotalCents,
    getPendingSubtotalCentsPromise,
} from '@/lib/ai/pending-subtotal-cache'

const PREFILL_TIMEOUT_MS = 8000

// Guarded so a missing env var (CI / preview environment / fresh clone)
// surfaces as the colocated error.tsx boundary instead of an unhandled
// loadStripe(undefined) crash inside EmbeddedCheckoutProvider.
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null

type Stage = 'form' | 'submitting' | 'checkout'
type ViewerKind = 'loading' | 'guest' | 'authed'

export default function CheckoutPage() {
    const router = useRouter()
    const [screenshotPaths, setScreenshotPaths] = useState<string[]>([])
    const [previewUrls, setPreviewUrls] = useState<string[]>([])
    const [viewerKind, setViewerKind] = useState<ViewerKind>('loading')

    const [name, setName] = useState('')
    const [eatery, setEatery] = useState('')
    const [subtotal, setSubtotal] = useState('')
    const [subtotalPending, setSubtotalPending] = useState(false)
    const [stage, setStage] = useState<Stage>('form')
    const [clientSecret, setClientSecret] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const initialized = useRef(false)
    const prefillInitialized = useRef(false)
    const subtotalDirty = useRef(false)
    const subtotalRef = useRef(subtotal)
    subtotalRef.current = subtotal

    // Auto-fill setter — only writes when the user has not typed and the field
    // is still empty. Prevents the late-resolve case from clobbering a manual
    // edit. Used by the prefill effect; user typing flows through
    // handleUserSubtotalChange instead (which flips subtotalDirty).
    /**
     * Auto-fills the Cart Total input from a Gemini-extracted cents value.
     * Guards: never overwrites a user edit (subtotalDirty), never overwrites
     * an already-populated field, and re-validates the sanity bounds in case
     * the value came from sessionStorage (which a user could tamper with).
     * @param cents - Integer cents from extract-price or sessionStorage cache
     * @called-by mount prefill useEffect, late-resolve subscription
     */
    const tryAutofillSubtotal = (cents: number) => {
        if (subtotalDirty.current) return
        if (subtotalRef.current !== '') return
        if (cents < CART_TOTAL_MIN_CENTS || cents > CART_TOTAL_MAX_CENTS) return
        setSubtotal((cents / 100).toFixed(2))
    }

    /**
     * User-driven subtotal setter. Flips subtotalDirty so the prefill
     * effect's late-resolve hook will not clobber the manual edit.
     * @param v - Raw input value from the Cart Total <Input>
     * @called-by CheckoutForm onChange
     */
    const handleUserSubtotalChange = (v: string) => {
        subtotalDirty.current = true
        setSubtotal(v)
    }

    // sessionStorage bootstrap — redirect home if no screenshots are queued.
    useEffect(() => {
        if (initialized.current) return
        initialized.current = true
        const raw = sessionStorage.getItem(PENDING_SCREENSHOTS_KEY)
        let paths: string[] = []
        if (raw) {
            try {
                const parsed: unknown = JSON.parse(raw)
                if (Array.isArray(parsed) && parsed.every((p): p is string => typeof p === 'string')) {
                    paths = parsed
                }
            } catch {
                // Malformed sessionStorage — fall through to redirect.
            }
        }
        if (paths.length === 0) {
            router.replace('/')
            return
        }
        setScreenshotPaths(paths)
    }, [router])

    // Auto-prefill the Cart Total from Gemini's extracted value.
    //   - If sessionStorage already has a resolved cents (post-resolve or
    //     reload-after-resolve), seed immediately.
    //   - Else if the home page registered an in-flight Promise, await it
    //     with an 8s timeout (skeleton overlay shown while pending).
    //   - On timeout, attach a late-resolve hook so a slow backend still
    //     fills the input — gated by subtotalDirty so a user edit wins.
    useEffect(() => {
        if (prefillInitialized.current) return
        prefillInitialized.current = true

        const cached = sessionStorage.getItem(PENDING_SUBTOTAL_CENTS_KEY)
        if (cached !== null) {
            const n = Number(cached)
            if (Number.isInteger(n) && n >= CART_TOTAL_MIN_CENTS && n <= CART_TOTAL_MAX_CENTS) {
                tryAutofillSubtotal(n)
            }
            return
        }

        const pending = getPendingSubtotalCentsPromise()
        if (!pending) return

        setSubtotalPending(true)
        let settled = false
        const timer = setTimeout(() => {
            if (settled) return
            setSubtotalPending(false)
            // Late-resolve subscription: still fills the input if the user
            // has not started typing by the time the slow response lands.
            void pending.then((cents) => {
                if (cents !== null) tryAutofillSubtotal(cents)
            })
        }, PREFILL_TIMEOUT_MS)

        void pending.then((cents) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            setSubtotalPending(false)
            if (cents !== null) tryAutofillSubtotal(cents)
        })
        // Intentionally one-shot: this effect runs once on mount, gated by
        // prefillInitialized.current. tryAutofillSubtotal is safe to call
        // from the closure because it reads subtotalDirty/subtotalRef from
        // refs (live values), not from closed-over state.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Resolve viewerKind: a Supabase user without a profile row is a guest
    // for backend purposes (the API requires guest_name in that case).
    useEffect(() => {
        let cancelled = false
        void (async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                if (!cancelled) setViewerKind('guest')
                return
            }
            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .maybeSingle()
            if (cancelled) return
            setViewerKind(profile ? 'authed' : 'guest')
        })()
        return () => { cancelled = true }
    }, [])

    // Load signed display URLs for the cart preview.
    // Server-side signing: at /checkout no orders row exists yet (the row is
    // inserted by the Stripe payment_intent.succeeded webhook), so the
    // cart-screenshots Storage RLS policy denies a client-side createSignedUrls
    // call (no orders.cart_screenshot_urls row to scope against). The /sign
    // endpoint uses the service client to bypass RLS.
    useEffect(() => {
        if (screenshotPaths.length === 0) return
        let cancelled = false
        void (async () => {
            const res = await fetch('/api/cart-screenshots/sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paths: screenshotPaths }),
            })
            if (cancelled || !res.ok) return
            const json: { signed_urls?: string[] } = await res.json().catch(() => ({}))
            setPreviewUrls(json.signed_urls ?? [])
        })()
        return () => { cancelled = true }
    }, [screenshotPaths])

    const subtotalCents = parseCents(subtotal)
    const split = subtotalCents !== null ? computeSplit(subtotalCents) : null
    const eateryValid = eatery.trim().length >= 1 && eatery.trim().length <= 80
    const subtotalValid = subtotalCents !== null && subtotalCents >= 50
    const nameValid = viewerKind === 'authed' ? true : name.trim().length > 0
    const canSubmit =
        eateryValid && subtotalValid && nameValid &&
        stage === 'form' && viewerKind !== 'loading'

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!canSubmit || subtotalCents === null) return
        setStage('submitting')
        setError(null)

        const body: Record<string, unknown> = {
            restaurant_name: eatery.trim(),
            cart_screenshot_paths: screenshotPaths,
            subtotal_cents: subtotalCents,
        }
        if (viewerKind === 'guest') {
            body.guest_name = name.trim()
            const pendingSchoolId = sessionStorage.getItem(PENDING_SCHOOL_ID_KEY)
            if (pendingSchoolId) body.school_id = pendingSchoolId
        }

        try {
            const res = await fetch('/api/stripe/checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const json = await res.json() as { clientSecret?: string; error?: string }
            if (!res.ok) throw new Error(json.error ?? 'Failed to create payment session')
            if (!json.clientSecret) throw new Error('No client secret returned')
            // Clear sessionStorage only after the session is confirmed so a Stripe
            // failure leaves the paths behind for retry.
            sessionStorage.removeItem(PENDING_SCREENSHOTS_KEY)
            sessionStorage.removeItem(PENDING_SCHOOL_ID_KEY)
            clearPendingSubtotalCents()
            setClientSecret(json.clientSecret)
            setStage('checkout')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
            setStage('form')
        }
    }

    if (clientSecret) {
        if (!stripePromise) {
            // Should never happen — the POST that returned the clientSecret would
            // have failed first — but a missing publishable key would still leave
            // the iframe unmounted. Surface the error inline rather than crash.
            throw new Error('Stripe publishable key is not configured')
        }
        return (
            <main
                data-testid="checkout-page"
                className="mx-auto max-w-3xl py-6 sm:py-10"
            >
                <div className="mb-4">
                    <BackButton />
                </div>
                <Surface
                    tone="subtle"
                    padding="none"
                    data-testid="checkout-stripe-embedded"
                    className="overflow-hidden"
                >
                    <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                        <EmbeddedCheckout />
                    </EmbeddedCheckoutProvider>
                </Surface>
            </main>
        )
    }

    const isSubmitting = stage === 'submitting'

    return (
        <main
            data-testid="checkout-page"
            className="mx-auto max-w-5xl py-6 sm:py-10"
        >
            <div className="mb-6">
                <BackButton />
            </div>

            <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-12">
                <section
                    data-testid="checkout-cart-preview"
                    className="flex flex-col gap-3"
                >
                    <h2 className="text-sm font-medium text-muted-foreground">Your cart</h2>
                    {previewUrls.length === 0 ? (
                        <CartScreenshotSkeleton />
                    ) : (
                        <div className="flex flex-col gap-3">
                            {previewUrls.map((url, idx) => (
                                <CartScreenshot
                                    key={url}
                                    src={url}
                                    alt={`Cart screenshot ${idx + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </section>

                <section className="flex flex-col">
                    <header className="mb-6">
                        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                            Pay for your order.
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Make sure the total you enter matches the total in the screenshot!
                            <br /> Or else a swiper most likely won't accept your order.
                        </p>
                    </header>

                    {viewerKind === 'loading' ? (
                        <FormSkeleton />
                    ) : (
                        <CheckoutForm
                            kind={viewerKind}
                            name={name} setName={setName}
                            eatery={eatery} setEatery={setEatery}
                            subtotal={subtotal} setSubtotal={handleUserSubtotalChange}
                            subtotalPending={subtotalPending}
                            isSubmitting={isSubmitting}
                            canSubmit={canSubmit}
                            error={error}
                            ordererPaysCents={split?.ordererPaysCents ?? null}
                            onSubmit={handleSubmit}
                        />
                    )}
                </section>
            </div>
        </main>
    )
}

// --- Helpers ---

interface CheckoutFormProps {
    kind: 'guest' | 'authed'
    name: string
    setName: (v: string) => void
    eatery: string
    setEatery: (v: string) => void
    subtotal: string
    setSubtotal: (v: string) => void
    subtotalPending: boolean
    isSubmitting: boolean
    canSubmit: boolean
    error: string | null
    ordererPaysCents: number | null
    onSubmit: (e: React.FormEvent) => void
}

/**
 * Renders the guest- or authed-variant of the checkout form. The two share
 * 90%+ of their structure; the only difference is whether the name field is
 * present in the DOM and the testid carried by the form root.
 * @called-by CheckoutPage
 */
function CheckoutForm({
    kind, name, setName, eatery, setEatery, subtotal, setSubtotal,
    subtotalPending,
    isSubmitting, canSubmit, error, ordererPaysCents, onSubmit,
}: CheckoutFormProps) {
    const isGuest = kind === 'guest'
    const formTestId = isGuest ? 'checkout-form-guest' : 'checkout-form-authed'
    const buttonLabel = isSubmitting
        ? 'Creating session…'
        : ordererPaysCents !== null ? `Pay ${formatDollars(ordererPaysCents)}` : 'Pay'

    return (
        <form
            data-testid={formTestId}
            onSubmit={onSubmit}
            className="flex flex-col gap-4"
        >
            {isGuest && (
                <FieldRow label="Your full name" htmlFor="checkout-name">
                    <Input
                        id="checkout-name"
                        type="text"
                        placeholder="Jane Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={100}
                        disabled={isSubmitting}
                        autoComplete="name"
                    />
                </FieldRow>
            )}

            <FieldRow
                label="Campus Eatery Name"
                htmlFor="checkout-eatery">
                <Input
                    id="checkout-eatery"
                    type="text"
                    placeholder="e.g. Downstein, Jasper Kane"
                    value={eatery}
                    onChange={(e) => setEatery(e.target.value)}
                    maxLength={80}
                    disabled={isSubmitting}
                />
            </FieldRow>

            <FieldRow
                label="Cart Total"
                htmlFor="checkout-subtotal"
                hint={
                    ordererPaysCents !== null
                        ? `You'll pay ${formatDollars(ordererPaysCents)} (60% off)`
                        : 'Minimum $0.50'
                }
            >
                <div className="relative">
                    <Input
                        id="checkout-subtotal"
                        data-testid="checkout-subtotal-input"
                        type="number"
                        inputMode="decimal"
                        placeholder="0.00"
                        min="0.50"
                        step="0.01"
                        value={subtotal}
                        onChange={(e) => setSubtotal(e.target.value)}
                        disabled={isSubmitting || subtotalPending}
                    />
                    {subtotalPending && (
                        <Skeleton
                            data-testid="checkout-subtotal-skeleton"
                            className="pointer-events-none absolute inset-0 rounded-md"
                        />
                    )}
                </div>
            </FieldRow>

            {error && (
                <p
                    data-testid="checkout-error-message"
                    role="alert"
                    className="text-sm text-destructive"
                >
                    {error}
                </p>
            )}

            <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={!canSubmit || isSubmitting}
                className="mt-2 w-full"
                data-testid="checkout-submit-button"
            >
                {buttonLabel}
            </Button>
        </form>
    )
}

/**
 * Loading-state placeholder for the auth-branched form. Mirrors the
 * eventual form's vertical rhythm so the layout doesn't reflow.
 */
function FormSkeleton() {
    return (
        <div className="flex flex-col gap-4" aria-busy>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="mt-2 h-9 w-full" />
        </div>
    )
}

interface FieldRowProps {
    label: string
    htmlFor: string
    hint?: string
    children: React.ReactNode
}

/**
 * Single label + control + optional hint stack. Inlined helper because the
 * pattern repeats four times across the two form variants.
 */
function FieldRow({ label, htmlFor, hint, children }: FieldRowProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={htmlFor} className="text-sm font-medium">
                {label}
            </label>
            {children}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    )
}

/**
 * Converts a user-entered dollar string to integer cents.
 * @param value - Dollar amount string (e.g. "12.50")
 * @returns Integer cents, or null if the input is invalid
 */
function parseCents(value: string): number | null {
    const n = parseFloat(value)
    if (isNaN(n) || n <= 0) return null
    return Math.round(n * 100)
}

/**
 * Formats integer cents as a US dollar string (e.g. 1250 → "$12.50").
 */
function formatDollars(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`
}
