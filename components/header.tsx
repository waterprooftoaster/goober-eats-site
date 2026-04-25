/**
 * @file header.tsx
 * @description Server-rendered navigation header. Branches on Principal kind
 *   (the discriminated union from lib/auth/resolve-principal.ts — first real
 *   layout consumer in S07): anon → sign-in/sign-up; authed orderer or swiper →
 *   home + orders + current-orders + account icon links. Brand voice per
 *   .impeccable.md principle 5: nearly invisible chrome — sits on bg-background
 *   with at most a hairline border.
 *   Called by: app/layout.tsx
 * @dependencies @/lib/auth/resolve-principal (Principal type)
 */

import Link from 'next/link'
import { Home, ListOrdered, MessageSquare, User } from 'lucide-react'
import type { Principal } from '@/lib/auth/resolve-principal'

interface Props {
  principal: Principal
}

/**
 * Renders the top navigation bar branching on principal.kind.
 * @param principal - Discriminated union of auth states resolved server-side in app/layout.tsx
 * @returns Header element with the appropriate nav cluster for the principal
 * @called-by app/layout.tsx
 */
export function Header({ principal }: Props) {
  const isAnon = principal.kind === 'anon' || principal.kind === 'guest_cookie'

  return (
    <header data-testid="header" className="flex items-center justify-between border-b border-border/60 bg-background px-6 py-3">
      <Link href="/" className="flex items-center" data-testid="header-home-link">
        <span className="font-display text-lg leading-none text-foreground">
          <span className="font-semibold tracking-tight">goober</span>
          <span className="font-extrabold"> Eats</span>
        </span>
      </Link>

      {isAnon ? (
        <div className="flex items-center gap-1" data-testid="header-auth-buttons">
          <Link
            href="/auth/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Log in
          </Link>
          <Link
            href="/auth/login"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Sign up
          </Link>
        </div>
      ) : (
        <nav className="flex items-center gap-1">
          {/* Home icon — the wordmark above already carries the catalog
              `header-home-link` testid; this duplicate would trip Playwright
              strict mode. Keep aria-label so screen readers still see it. */}
          <Link
            href="/"
            aria-label="Home"
            className={iconLinkClass}
          >
            <Home className="h-5 w-5" />
          </Link>
          <Link
            href="/orders"
            aria-label="Order history"
            data-testid="header-orders-link"
            className={iconLinkClass}
          >
            <ListOrdered className="h-5 w-5" />
          </Link>
          <Link
            href="/current-orders"
            aria-label="Current orders"
            data-testid="header-current-orders-link"
            className={iconLinkClass}
          >
            <MessageSquare className="h-5 w-5" />
          </Link>
          <Link
            href="/account"
            aria-label="Account"
            data-testid="header-account-link"
            className={iconLinkClass}
          >
            <User className="h-5 w-5" />
          </Link>
        </nav>
      )}
    </header>
  )
}

// --- Helpers ---

const iconLinkClass =
  'rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
