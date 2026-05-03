/**
 * @file page.tsx
 * @description Celebratory onboarding page shown after Stripe Connect completes.
 *   Walks the new swiper through the 3-step job: find orders, fill the cart,
 *   send the receipt. Static server component.
 *   Called by: app/stripe/onboard/complete/page.tsx (redirect on success)
 * @dependencies components/ui/button, next/image, next/link
 */

import Image from 'next/image'
import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Swiper welcome page — 3-step job explainer shown once after onboarding.
 * @returns Static server-rendered welcome page
 * @called-by app/stripe/onboard/complete/page.tsx
 */
export default function SwiperWelcomePage() {
    return (
        <main className="mx-auto max-w-xl px-6 py-14">
            <div className="flex flex-col">

                <header className="mb-12 flex flex-col gap-2">
                    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        Swiper activated
                    </p>
                    <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight">
                        Here&apos;s how<br />it works.
                    </h1>
                </header>

                <ol className="flex flex-col gap-12">
                    <Step number="01" heading="Find open orders.">
                        <div className="flex items-start gap-4">
                            <span className="flex-1 min-w-0">
                                Tap the icon in the bottom-left corner of any page. It shows every
                                unfilled order at your school.
                            </span>
                            <div
                                aria-hidden
                                className="flex-shrink-0 flex flex-col items-center gap-1.5 pt-0.5"
                            >
                                <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg">
                                    <ClipboardList className="h-5 w-5" />
                                    <span className="absolute -right-1 -top-1 inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground shadow-sm ring-2 ring-background">
                                        3
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Step>

                    <Step number="02" heading="Order exactly what's in their cart.">
                        Read the user&apos;s GrubHub cart and place the order. Let the user know what name to pick up under.
                    </Step>

                    <Step number="03" heading="Send the GrubHub receipt.">
                        After you place the order, screenshot the GrubHub receipt and upload it under &quot;Complete Order&quot;. That closes the
                        order,and triggers your payout.
                        {/* Rotation:  change -rotate-1 (try rotate-1, -rotate-2, rotate-0)       */}
                        {/* Size:      change max-w-[260px] — wider = bigger phone               */}
                        {/* Ratio:     change aspect-[9/17] — raise 2nd num = taller = less crop */}
                        {/* Position:  change object-bottom — try object-[50%_80%] to shift up   */}
                        <div className="mt-5 -rotate-1 overflow-hidden rounded-xl ring-1 ring-border shadow-sm max-w-[260px] sm:max-w-[320px]">
                            <div className="relative aspect-[9/12]">
                                <Image
                                    src="/receipt.png"
                                    alt="GrubHub completed order receipt showing itemized pricing: Subtotal $7.69, Tax $0.00, Total $7.69, paid with Dining Dollars"
                                    fill
                                    className="object-cover object-[50%_60%]"
                                    priority
                                />
                            </div>
                        </div>
                    </Step>
                </ol>

                <div className="mt-14 flex flex-col gap-2">
                    <Button variant="primary" size="lg" asChild className="w-full sm:w-auto">
                        <Link href="/swiper/orders">Find orders →</Link>
                    </Button>
                    <p className="text-sm text-muted-foreground">
                        You keep 90% of what the user paid.
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
 * @called-by SwiperWelcomePage
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
