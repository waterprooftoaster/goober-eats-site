/**
 * @file page.tsx
 * @description Home page with a CTA directing users to place an order.
 *   Called by: Next.js routing (direct navigation to /)
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * Renders the Goober Eats home page with a "Place an Order" call-to-action.
 * @returns Static hero section with a link to /order/new
 * @called-by Next.js routing (/)
 */
export default function HomePage() {
    return (
        <main className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
            <h1 className="text-4xl font-extrabold mb-3">Goober Eats</h1>
            <p className="text-gray-500 mb-8 max-w-sm">
                Upload your GrubHub cart. A swiper at your school fills it.
            </p>
            <Button asChild size="lg">
                <Link href="/order/new">Place an Order</Link>
            </Button>
        </main>
    )
}
