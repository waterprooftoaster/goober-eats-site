/**
 * @file page.tsx
 * @description Current-orders surface: server component that fetches the caller's
 *   active orders and renders an embedded ChatView per row. Forks the query on
 *   `user.is_anonymous` (mirrors components/chat-panel/chat-panel-provider.tsx):
 *   anonymous Supabase users (guests) filter by `anon_user_id`, real users by
 *   `orderer_id`/`swiper_id`. Both flavors render the same CurrentOrdersList so
 *   the UI is identical end-to-end. Redirects to /auth/login when there's no
 *   Supabase session at all.
 *   Called by: Next.js routing (/current-orders); Stripe checkout return.
 * @dependencies lib/supabase/server.ts, ./current-orders-list
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signCartScreenshotPaths } from '@/lib/storage/sign-screenshots'
import { CurrentOrdersList } from './current-orders-list'
import type { OrderStatus } from '@/lib/types/database'

interface CurrentOrderRow {
    id: string
    status: OrderStatus
    restaurant_name: string | null
    cart_screenshot_urls: string[] | null
}

/**
 * Renders the caller's active orders (open + in_progress only). Same shell and
 * list component for guests (anon Supabase user, filtered by anon_user_id) and
 * real users (filtered by orderer_id / swiper_id). Anyone without a Supabase
 * session is redirected to /auth/login.
 * @returns The page element, or a redirect for ineligible callers
 * @called-by Next.js App Router (/current-orders)
 */
export default async function CurrentOrdersPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    const isAnon = user.is_anonymous ?? false

    const baseQuery = supabase
        .from('orders')
        .select('id, status, restaurant_name, cart_screenshot_urls')
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })

    const { data: orders } = isAnon
        ? await baseQuery.eq('anon_user_id', user.id)
        : await baseQuery.or(`orderer_id.eq.${user.id},swiper_id.eq.${user.id}`)

    // cart_screenshot_urls stores raw Supabase Storage paths; the lightbox
    // needs a signed URL. Mint per-row in parallel (matches the convention in
    // app/swiper/orders/page.tsx and app/api/orders/route.ts).
    const rows = await Promise.all(
        ((orders ?? []) as CurrentOrderRow[]).map(async (o) => {
            const firstPath = o.cart_screenshot_urls?.[0] ?? null
            const cartScreenshotUrl = firstPath
                ? (await signCartScreenshotPaths([firstPath]))[0] ?? null
                : null
            return {
                id: o.id,
                status: o.status,
                restaurantName: o.restaurant_name ?? '',
                cartScreenshotUrl,
            }
        })
    )

    return (
        <main
            data-testid="current-orders-page"
            className="mx-auto max-w-3xl py-8 sm:py-12"
        >
            <header className="mb-8">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    Current orders.
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Your active orders, chat with the other side here. Refresh every so often, I just made this app and it isn&apos;t very responsive yet. <br /> It&apos;ll improve soon!
                </p>
            </header>
            <CurrentOrdersList orders={rows} currentUserId={user.id} />
        </main>
    )
}
