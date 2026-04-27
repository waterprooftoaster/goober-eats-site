/**
 * @file cover-page.tsx
 * @description Unauthenticated landing page shown at the root route. Editorial-feel
 *   composition: hero with school selector, three-step "how it works" using oversized
 *   numerals as the visual anchor, two-column "for both sides" closing block, minimal
 *   footer. All content sits inside a 1100px container with consistent rhythm.
 *   Called by: app/page.tsx (unauthenticated branch)
 * @dependencies components/school-search-pill.tsx
 */

import Link from 'next/link'
import SchoolSearchPill from '@/components/school-search-pill'

interface School {
    id: string
    name: string
}

interface CoverPageProps {
    schools: School[]
}

/**
 * Renders the unauthenticated cover page: hero, how-it-works, two-side info, footer.
 * @param schools - List of schools to populate the selector
 * @returns Full-bleed sections with content constrained to a centered 1100px column
 * @called-by app/page.tsx
 */
export default function CoverPage({ schools }: CoverPageProps) {
    return (
        // Break out of the layout's px-6 wrapper so section backgrounds span edge-to-edge
        <div id="top" className="-mx-6 scroll-smooth">
            <HeroSection schools={schools} />
            <HowItWorks />
            <InfoColumns />
            <CoverFooter />
        </div>
    )
}

// --- Helpers ---

const CONTAINER = 'max-w-[1100px] mx-auto px-6'
const EYEBROW = 'text-[11px] font-semibold tracking-[0.22em] uppercase text-muted-foreground'

/**
 * Hero block: small eyebrow, oversized headline, supporting copy, school selector.
 * Left-aligned inside the shared 1100px container — no decorative SVG, no asymmetric offset.
 * @param schools - Schools to populate the selector
 * @called-by CoverPage
 */
function HeroSection({ schools }: { schools: School[] }) {
    return (
        <section className="bg-background text-foreground pt-28 md:pt-40 pb-20 md:pb-28">
            <div className={CONTAINER}>
                <p className={`${EYEBROW} mb-6`}>
                    Campus food &middot; half the cost
                </p>
                <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.02] tracking-tight mb-6 max-w-[18ch]">
                    Your friend&rsquo;s swipes
                    <br />
                    can be feeding you.
                </h1>
                <p className="text-base md:text-lg text-muted-foreground max-w-[54ch] mb-10 leading-relaxed">
                    We'll pair you with a student who&rsquo;s got extra meal swipes. You
                    get a discount, they earn &mdash; it&rsquo;s a win-win.
                </p>
                <div className="max-w-[360px]">
                    <SchoolSearchPill
                        schools={schools}
                        ctaHref="/order/new"
                        ctaColor="#A1C935"
                        ctaArrowColor="#000000"
                        placeholder="Select your school"
                        emptyMessage="No schools available"
                        noResultsMessage="No schools found"
                    />
                </div>
            </div>
        </section>
    )
}

/**
 * Three-step "how it works" grid. Each step is anchored by an oversized brand-green
 * numeral (Bricolage Grotesque), with the step name and body following below.
 * Replaces the prior scroll-pinned stepper + giant SVG. No motion, no scroll-jacking.
 * @called-by CoverPage
 */
function HowItWorks() {
    return (
        <section className="bg-background border-t border-border py-24 md:py-32">
            <div className={CONTAINER}>
                <p className={`${EYEBROW} mb-4`}>How it works</p>
                <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-[1.05] mb-16 md:mb-20 max-w-[20ch]">
                    Three taps and you&rsquo;re eating.
                </h2>
                <ol className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-10 list-none">
                    <Step
                        n="01"
                        title="Snap your cart"
                        body="Go on the GrubHub "
                    />
                    <Step
                        n="02"
                        title="Drop it in"
                        body="Upload it here on Goober and tell us what you&rsquo;d like to pay."
                    />
                    <Step
                        n="03"
                        title="Eat"
                        body="A student at your school grabs the order with their meal plan and brings it your way."
                    />
                </ol>
            </div>
        </section>
    )
}

/**
 * One column inside HowItWorks: oversized accent-green numeral above a tight title + body.
 * @param n - Two-digit step number (e.g. "01")
 * @param title - Short step name
 * @param body - One-sentence description
 * @called-by HowItWorks
 */
function Step({ n, title, body }: { n: string; title: string; body: string }) {
    return (
        <li>
            <p
                className="font-display text-7xl md:text-8xl font-extrabold leading-none mb-5 tabular-nums"
                style={{ color: 'var(--color-accent)' }}
            >
                {n}
            </p>
            <h3 className="font-display text-xl md:text-2xl font-bold mb-2 leading-snug">
                {title}
            </h3>
            <p className="text-base text-muted-foreground leading-relaxed max-w-[32ch]">
                {body}
            </p>
        </li>
    )
}

/**
 * Closing two-column block addressing both sides of the marketplace. Each side gets
 * a heading, body copy, and an underlined inline CTA — no boxed cards, no centered
 * layout, no anemic icon-and-blurb pattern.
 * @called-by CoverPage
 */
function InfoColumns() {
    return (
        <section
            className="bg-background border-t border-border py-24 md:py-32"
            data-testid="info-columns"
        >
            <div className={CONTAINER}>
                <p className={`${EYEBROW} mb-12`}>For both sides of the table</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20">
                    <SideBlock
                        heading={<>Same food.<br />Half the cost.</>}
                        body="Snap your GrubHub cart and a student at your school grabs it with their meal plan. You eat well, they get paid."
                        ctaLabel="Order now"
                        ctaHref="#top"
                    />
                    <SideBlock
                        heading={<>Got swipes you&rsquo;ll<br />never use?</>}
                        body="Pick up orders from people on campus and turn extra dining dollars into cash — straight to your bank."
                        ctaLabel="Become a swiper"
                        ctaHref="/swiper-registration"
                    />
                </div>
            </div>
        </section>
    )
}

/**
 * One side of InfoColumns. Heading is provided as a node so callers can include line breaks.
 * @param heading - Display heading (allows <br />)
 * @param body - Supporting paragraph
 * @param ctaLabel - Inline CTA text
 * @param ctaHref - CTA link target
 * @called-by InfoColumns
 */
function SideBlock({
    heading,
    body,
    ctaLabel,
    ctaHref,
}: {
    heading: React.ReactNode
    body: string
    ctaLabel: string
    ctaHref: string
}) {
    return (
        <div>
            <h3 className="font-display text-3xl md:text-4xl font-bold leading-[1.1] tracking-tight mb-5">
                {heading}
            </h3>
            <p className="text-base text-muted-foreground leading-relaxed mb-7 max-w-[44ch]">
                {body}
            </p>
            <Link
                href={ctaHref}
                className="inline-flex items-center gap-2 text-sm font-semibold text-foreground border-b border-foreground/40 pb-1 hover:border-foreground transition-colors"
            >
                {ctaLabel}
                <span aria-hidden="true">&rarr;</span>
            </Link>
        </div>
    )
}

/**
 * Minimal footer strip: wordmark on the left, copyright + tagline on the right.
 * Closes the page so it doesn&rsquo;t end on a soft fade.
 * @called-by CoverPage
 */
function CoverFooter() {
    return (
        <footer className="bg-background border-t border-border py-10">
            <div className={`${CONTAINER} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}>
                <p className="font-display text-xl font-extrabold tracking-tight">
                    Goober<span style={{ color: 'var(--color-accent)' }}>.</span>
                </p>
                <p className="text-xs text-muted-foreground">
                    &copy; {new Date().getFullYear()} &middot; Built for college students
                </p>
            </div>
        </footer>
    )
}
