/**
 * @file page.tsx
 * @description Welcome page shown once after a new orderer account is created.
 *   Walks the new user through how Goober Eats works. Static server component.
 *   Called by: app/auth/login/login-form.tsx (redirect on onboarding success)
 * @dependencies components/ui/button, next/image, next/link
 */

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * Orderer welcome page — 3-step how-it-works explainer shown once after signup.
 * @returns Static server-rendered welcome page
 * @called-by app/auth/login/login-form.tsx
 */
export default function WelcomePage() {
    return (
        <main className="mx-auto max-w-xl px-6 py-14">
            <div className="flex flex-col">

                <header className="mb-12 flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        Welcome to Goober Eats
                    </p>
                    <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight">
                        Here&apos;s how<br />it works.
                    </h1>
                </header>

                <ol className="flex flex-col gap-12">
                    <Step number="01" heading="Screenshot your GrubHub cart.">
                        Build your cart on GrubHub, then take a screenshot of it — including the
                        subtotal. Upload it here and we&apos;ll read the total for you.
                        <div className="mt-5 -rotate-1 overflow-hidden rounded-xl ring-1 ring-border shadow-sm max-w-[260px] sm:max-w-[320px]">
                            <div className="relative aspect-[9/12]">
                                <Image
                                    src="/cart.PNG"
                                    alt="GrubHub cart screenshot showing items and subtotal"
                                    fill
                                    className="object-cover object-top"
                                    priority
                                />
                            </div>
                        </div>
                    </Step>

                    <Step number="02" heading="Confirm the total and pay.">
                        Enter the amount you&apos;ll pay — we pre-fill it from your screenshot.
                        We hold the charge until your order is fulfilled.
                    </Step>

                    <Step number="03" heading="A swiper places the order for you.">
                        A student at your school buys exactly what&apos;s in your cart using their
                        meal plan. They message you the pickup name and send a photo when it&apos;s done.
                    </Step>
                </ol>

                <div className="mt-14 flex flex-col gap-2">
                    <Button variant="primary" size="lg" asChild className="w-full sm:w-auto">
                        <Link href="/">Place an order →</Link>
                    </Button>
                    <p className="text-sm text-muted-foreground">
                        You only pay what you entered — no hidden fees.
                    </p>
                </div>

            </div>
        </main>
    )
}

// --- Helpers ---

interface StepProps {
    number: string
    heading: string
    children: React.ReactNode
}

/**
 * Single numbered step row with large muted ordinal and content.
 * @param number - Display ordinal string ("01", "02", "03")
 * @param heading - Bold step title
 * @param children - Body text and optional visual
 * @called-by WelcomePage
 */
function Step({ number, heading, children }: StepProps) {
    return (
        <li className="flex gap-4">
            <span
                aria-hidden
                className="select-none font-display text-[5.5rem] font-extrabold leading-none text-foreground/[0.08] shrink-0 w-16 -mt-2"
            >
                {number}
            </span>
            <div className="flex flex-col gap-2 pt-1 min-w-0">
                <h2 className="text-lg font-bold leading-snug tracking-tight">
                    {heading}
                </h2>
                <div className="text-[15px] leading-relaxed text-muted-foreground">
                    {children}
                </div>
            </div>
        </li>
    )
}
