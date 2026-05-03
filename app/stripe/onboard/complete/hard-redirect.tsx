'use client'

/**
 * @file hard-redirect.tsx
 * @description Client component that performs a hard browser navigation on
 *   mount via window.location.assign, ensuring SSR re-resolves the principal
 *   and Realtime providers are torn down. Used by the Stripe onboard complete
 *   page instead of next/navigation redirect() so the swiper welcome page
 *   always gets a full page load.
 *   Called by: app/stripe/onboard/complete/page.tsx
 */

import { useEffect } from 'react'

interface HardRedirectProps {
  to: string
}

/**
 * Immediately navigates the browser to `to` on mount via window.location.assign.
 * @param to - The URL to navigate to
 * @called-by app/stripe/onboard/complete/page.tsx
 */
export function HardRedirect({ to }: HardRedirectProps) {
  useEffect(() => {
    window.location.assign(to)
  }, [to])
  return null
}
