/**
 * @file page.tsx
 * @description Home page entry point. Unauthenticated visitors see the cover/landing page;
 *   authenticated users see the existing home experience.
 *   Called by: Next.js routing (direct navigation to /)
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts, components/cover-page.tsx
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import CoverPage from '@/components/cover-page'

/**
 * Renders either the cover page (unauthenticated) or the home experience (authenticated).
 * Gating is a server-component branch: no middleware redirect, no client-side check.
 * @returns Cover page for anon users; home hero for authenticated users
 * @called-by Next.js routing (/)
 */
export default async function HomePage() {
    const supabase = await createClient()
    const user = await getAuthenticatedUser(supabase)

    if (user) {
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

    const { data: schools } = await supabase
        .from('schools')
        .select('id, name')
        .order('name')

    return <CoverPage schools={schools ?? []} />
}
