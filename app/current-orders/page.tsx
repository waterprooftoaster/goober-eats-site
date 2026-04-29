/**
 * @file page.tsx
 * @description Current-orders surface: server component fetches the user's
 *   active orders (orderer or swiper leg) keyed off the new `restaurant_name`
 *   column, then hands off to the client list which embeds a ChatView per
 *   order. Redirects unauthenticated users to /auth/login.
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
 * Renders the authenticated user's active orders (open + in_progress only).
 * Completed orders live on /orders (history). Each row is a card hosting
 * the embedded ChatView; realtime status updates propagate via the
 * ChatPanel provider on the client side.
 * @returns The page element, or a redirect to /auth/login for anon callers
 * @called-by Next.js App Router (/current-orders)
 */
export default async function CurrentOrdersPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    const { data: orders } = await supabase
        .from('orders')
        .select('id, status, restaurant_name, cart_screenshot_urls')
        .or(`orderer_id.eq.${user.id},swiper_id.eq.${user.id}`)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })

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
                    Your active orders, chat with the other side here. Refresh every so often, I just made this app and it isn't very responsive yet. <br /> It'll improve soon!
                </p>
            </header>
            <CurrentOrdersList orders={rows} currentUserId={user.id} />
        </main>
    )
}
