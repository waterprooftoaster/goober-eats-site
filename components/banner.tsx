'use client'

/**
 * @file banner.tsx
 * @description Promotional "become a swiper" banner. Visible only on the home
 *   route (`/`) and only when the viewer is NOT a swiper. Brand voice
 *   (.impeccable.md) — minimal chrome, ONE lime CTA per screen, tinted
 *   neutrals. Replaces the deleted app/@banner/ parallel slot (S07 ADR-1).
 *   Called by: app/layout.tsx
 * @dependencies @/components/ui/surface, @/components/ui/button
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'

interface BannerProps {
  /** Hides the banner for swipers (recruitment is irrelevant once enrolled). */
  isSwiper: boolean
  /** Routes the CTA: logged-in users go to /account; anon users to /auth/login. */
  isLoggedIn: boolean
}

/**
 * Renders the recruitment banner; returns null off the home route or for swipers.
 * @param isSwiper - Whether the current viewer is already a swiper
 * @param isLoggedIn - Whether the viewer has an authenticated session
 * @returns Banner JSX, or null if the route/role guards apply
 * @called-by app/layout.tsx
 */
export function Banner({ isSwiper, isLoggedIn }: BannerProps) {
  const pathname = usePathname()
  if (isSwiper || pathname !== '/') return null

  return (
    <Surface
      data-testid="become-swiper-banner"
      tone="muted"
      padding="lg"
      className="mx-auto mt-6 flex max-w-[1200px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Expiring meal swipes? Earn from your phone.
        </h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          Get paid for the meals you won&apos;t use this semester.
        </p>
      </div>
      <Button asChild variant="primary" size="lg" className="self-start sm:self-auto">
        <Link href={isLoggedIn ? '/account' : '/auth/login'}>Become a swiper</Link>
      </Button>
    </Surface>
  )
}
