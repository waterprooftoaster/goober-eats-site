/**
 * @file header.tsx
 * @description Server-rendered navigation header with logo, auth links, and live cart item badge.
 *   Called by: app/layout.tsx (via HeaderWrapper)
 * @dependencies lib/supabase/server.ts, lib/supabase/service.ts, components/header-cart-button.tsx
 */

import Link from "next/link"
import { cookies } from "next/headers"
import { Home, User } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getAuthenticatedUser } from "@/lib/api/helpers"
import { HeaderCartButton } from "@/components/header-cart-button"

const iconBtnClass = "rounded-full p-2 text-white transition-colors hover:bg-white/10"

/**
 * Fetches the current cart item count and renders the top navigation bar.
 * @returns Header with logo, home/account links, HeaderCartButton, and sign-in/up links for guests
 * @called-by app/layout.tsx
 */
export async function Header() {
    const supabase = await createClient()
    const user = await getAuthenticatedUser(supabase)

    const cookieStore = await cookies()
    const service = createServiceClient()
    let itemCount = 0
    {
        let cartId: string | null = null
        if (user) {
            const { data } = await service.from('carts').select('id').eq('user_id', user.id).maybeSingle()
            cartId = data?.id ?? null
        } else {
            const sessionId = cookieStore.get('cart_session_id')?.value
            if (sessionId) {
                const { data } = await service.from('carts').select('id').eq('session_id', sessionId).maybeSingle()
                cartId = data?.id ?? null
            }
        }
        if (cartId) {
            const { data: items } = await service.from('cart_items').select('quantity').eq('cart_id', cartId)
            itemCount = (items ?? []).reduce((sum, i) => sum + (i.quantity as number), 0)
        }
    }

    return (
        <header className="flex items-center justify-between px-5 py-3">
            <Link href="/" className="flex items-center ml-5">
                <span className="text-white text-xl leading-none">
                    <span className="font-semibold tracking-tighter">goober</span>
                    <span className="font-extrabold"> Eats</span>
                </span>
            </Link>

            <div className="flex items-center gap-2">
                <div className="flex items-center">
                    <Link href="/" className={iconBtnClass} aria-label="Home">
                        <Home className="h-5 w-5" />
                    </Link>
                    {user && (
                        <Link href="/account" className={iconBtnClass} aria-label="Profile">
                            <User className="h-5 w-5" />
                        </Link>
                    )}
                </div>

                <HeaderCartButton itemCount={itemCount} />

                {!user && (
                    <>
                        <Link
                            href="/auth/login"
                            className="px-4 py-2 text-sm font-bold text-white"
                        >
                            Log In
                        </Link>
                        <Link
                            href="/auth/login"
                            className="rounded-full bg-white px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-gray-200"
                        >
                            Sign Up
                        </Link>
                    </>
                )}
            </div>
        </header>
    )
}
