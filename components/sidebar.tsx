"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClipboardList, Home, ShoppingCart, User } from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"

const navBtnClass =
  "flex items-center gap-3 w-full rounded-lg px-4 py-3 text-black text-sm font-medium hover:bg-black/10 transition-colors"

interface Props {
  user: SupabaseUser | null
  isSwiper?: boolean
  pendingOrderCount?: number
}

export function Sidebar({ user, isSwiper, pendingOrderCount = 0 }: Props) {
  const pathname = usePathname()

  const navClass = (href: string) => {
    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
    return `${navBtnClass}${isActive ? " opacity-50 pointer-events-none" : ""}`
  }

  return (
    <aside className="hidden lg:flex w-44 shrink-0 bg-white flex-col gap-1 p-3">
      <Link href="/" className={navClass("/")}>
        <Home className="h-5 w-5" />
        Home
      </Link>
      <Link href="/cart" className={navClass("/cart")}>
        <ShoppingCart className="h-5 w-5" />
        Cart
      </Link>
      {user && isSwiper && (
        <>
          <Link href="/swiper/orders" className={navClass("/swiper/orders")}>
            <span className="relative">
              <ClipboardList className="h-5 w-5" />
              {pendingOrderCount > 0 && (
                <span className="absolute -top-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {pendingOrderCount > 99 ? '99+' : pendingOrderCount}
                </span>
              )}
            </span>
            Pending Orders
          </Link>
</>
      )}
      {user && (
        <Link href="/orders" className={navClass("/orders")}>
          <ClipboardList className="h-5 w-5" />
          My Orders
        </Link>
      )}
      {user ? (
        <Link href="/account" className={navClass("/account")}>
          <User className="h-5 w-5" />
          Profile
        </Link>
      ) : (
        <Link href="/auth/login" className={navClass("/auth/login")}>
          Log In / Sign Up
        </Link>
      )}
    </aside>
  )
}
