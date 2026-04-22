/**
 * @file header.tsx
 * @description Server-rendered navigation header with logo and auth links.
 *   Called by: app/layout.tsx (via HeaderWrapper)
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts
 */

import Link from "next/link"
import { Home, User } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getAuthenticatedUser } from "@/lib/api/helpers"

const iconBtnClass = "rounded-full p-2 text-white transition-colors hover:bg-white/10"

/**
 * Renders the top navigation bar with logo, home/account icons, and sign-in/up links for guests.
 * @returns Navigation header
 * @called-by app/layout.tsx
 */
export async function Header() {
    const supabase = await createClient()
    const user = await getAuthenticatedUser(supabase)

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
