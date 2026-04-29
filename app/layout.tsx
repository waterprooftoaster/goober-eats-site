/**
 * @file layout.tsx
 * @description Root layout. Resolves the principal once via the §10 helper,
 *   passes server-derived booleans into Header / Banner / BottomDock.
 *   pendingOrderCount filters by school_id (catalog GLOBAL-SWIPER-BADGE).
 *   Called by: Next.js App Router (wraps all routes)
 * @dependencies @/lib/auth/resolve-principal, @/lib/supabase/server,
 *   @/components/{header,banner,chat-panel,bottom-dock}
 */

import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import "./globals.css"
import { bricolageGrotesque, figtree } from "./fonts"
import { Header } from "@/components/header"
import { Banner } from "@/components/banner"
import { ChatPanelProvider } from "@/components/chat-panel"
import { BottomDock } from "@/components/bottom-dock"
import { createClient } from "@/lib/supabase/server"
import { resolvePrincipal, type Principal } from "@/lib/auth/resolve-principal"

export const metadata: Metadata = {
  title: "Goober Eats",
  description: "Peer-to-peer student meal swipe sharing app",
}

/**
 * Root HTML shell. Resolves principal once, branches all auth-aware children
 * server-side, and renders Banner directly (parallel slot deleted in S07).
 * @param children - Page content
 * @returns The full HTML document
 * @called-by Next.js App Router
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const principal = await resolvePrincipal(supabase, cookieStore)
  const pathname = (await headers()).get('x-pathname') ?? ''

  const isSwiper =
    principal.kind === 'authed_swiper' || principal.kind === 'authed_swiper_pre_stripe'
  const isLoggedIn = principal.kind !== 'anon' && principal.kind !== 'guest_cookie'
  const userId = userIdFromPrincipal(principal)
  const pendingOrderCount = await pendingCountForSwiper(supabase, principal)

  return (
    <html
      lang="en"
      className={`${bricolageGrotesque.variable} ${figtree.variable} antialiased`}
      data-testid="root-layout"
    >
      <body>
        <ChatPanelProvider userId={userId}>
          <Header principal={principal} />
          {(isLoggedIn || pathname !== '/') && (
            <Banner isSwiper={isSwiper} isLoggedIn={isLoggedIn} />
          )}
          <main className="px-6 pb-24">{children}</main>
          <BottomDock isSwiper={isSwiper} pendingOrderCount={pendingOrderCount} />
        </ChatPanelProvider>
      </body>
    </html>
  )
}

// --- Helpers ---

/**
 * Extracts the userId from any principal kind that carries one. Returns null
 * for anon and guest_cookie variants (chat-panel-provider treats null as the
 * "do not subscribe / do not auto-open" signal).
 */
function userIdFromPrincipal(principal: Principal): string | null {
  switch (principal.kind) {
    case 'authed_orderer':
    case 'authed_swiper':
    case 'authed_swiper_pre_stripe':
      return principal.userId
    case 'guest_cookie':
      return principal.anonUserId
    default:
      return null
  }
}

/**
 * Returns the open-order count at the swiper's school for the floating badge.
 * Only authed_swiper (school_id required + Stripe complete) sees the count;
 * pre-stripe swipers see 0 because they cannot accept orders yet. Catalog
 * GLOBAL-SWIPER-BADGE: "orders.status='open' AND school_id=profile.school_id".
 */
async function pendingCountForSwiper(
  supabase: Awaited<ReturnType<typeof createClient>>,
  principal: Principal
): Promise<number> {
  if (principal.kind !== 'authed_swiper') return 0
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')
    .eq('school_id', principal.schoolId)
  return count ?? 0
}
