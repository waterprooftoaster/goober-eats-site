/**
 * @file cover-page.tsx
 * @description Unauthenticated landing / gate page shown at the root route.
 *   Full-bleed section backgrounds with content constrained to a ~430px centered
 *   mobile-width column. Hero section (black) above a 2-column info row (white).
 *   Called by: app/page.tsx (unauthenticated branch)
 * @dependencies components/ui/button.tsx, components/school-pill.tsx
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/header'
import { HeaderWrapper } from '@/components/header-wrapper'
import SchoolSearchPill from '@/components/school-search-pill'
import Burger from './icons/burger'
import ScrollStepperSection from '@/components/scroll-stepper-section'

interface School {
    id: string
    name: string
}

interface CoverPageProps {
    schools: School[]
}

/**
 * Renders the unauthenticated cover page with school selector and info blocks.
 * @param schools - List of schools to populate the selector
 * @returns Full-bleed sections with mobile-width content column
 * @called-by app/page.tsx
 */
export default function CoverPage({ schools }: CoverPageProps) {
    return (
        // Break out of the layout's px-6 wrapper so section backgrounds span edge-to-edge
        <div className="-mx-6 relative">
            <HeaderWrapper hasBanner={false}>
                <Header showHomeIcon={false} />
            </HeaderWrapper>
            <Burger
                height={1050}
                width={1050}
                className="absolute -top-45 right-20 rotate-0 text-white z-[51] pointer-events-none"
            />
            <HeroSection schools={schools} />
            <div className='bg-white py-100'> </div>
            <ScrollStepperSection />
            <InfoColumns />
            <div className="w-screen h-screen bg-gray-200"></div>
        </div>
    )
}

// --- Helpers ---

/**
 * Renders the black hero section with wordmark, tagline, school selector, and Continue CTA.
 * @param schools - Schools to populate the selector
 * @called-by CoverPage
 */
function HeroSection({ schools }: { schools: School[] }) {
    return (
        <section className="bg-black text-white py-60">
            <div className="max-w-[1440px] mx-auto">
                <div className="relative z-10 ml-32 px-6 text-xl">
                    <h1 className="text-4xl text-white font-extrabold mb-10">
                        50% OFF ALL DINING HALLS,
                        <br />
                        NOW.
                    </h1>
                    <div className="max-w-[300px]">
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
            </div>
        </section>
    )
}

/**
 * Renders the two info blocks side-by-side in a narrow 2-column grid.
 * White background spans full viewport width; content is centered within 430px.
 * @called-by CoverPage
 */
function InfoColumns() {
    return (
        <div className="bg-white" data-testid="info-columns">
            <div className="max-w-[1000px] mx-auto grid grid-cols-2">
                <div className="text-black flex flex-col items-center justify-start py-16 px-5 text-center">
                    <h2 className="text-xl font-bold mb-3">
                        Same food, <br /> Soo much cheaper.
                    </h2>
                    <p className="text-gray-600 text-sm leading-relaxed">
                        Upload your GrubHub cart. A student at your school fills the order
                        using their meal plan — you pay less, they earn more.
                    </p>
                </div>

                <div className="text-black flex flex-col items-center justify-start py-16 px-5 text-center">
                    <h2 className="text-xl font-bold mb-3">
                        Turn extra swipes into cash.
                    </h2>
                    <p className="text-gray-600 text-sm leading-relaxed mb-6">
                        Got unused dining dollars or meal swipes? Accept orders from students
                        at your school and pocket the difference.
                    </p>

                    <Button asChild size="sm">
                        <Link href="/auth/login">Become a Swiper</Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
