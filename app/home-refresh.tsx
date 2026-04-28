'use client'

/**
 * @file home-refresh.tsx
 * @description Triggers router.refresh() on mount so server components — most
 *   importantly the root layout's header (resolvePrincipal) — re-run after the
 *   user lands on /. Soft redirects from auth/account flows don't re-execute
 *   the root layout, so the header would otherwise show stale auth state.
 *   Called by: app/page.tsx
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Calls router.refresh() once on mount. Idempotent — only re-runs server
 * components and doesn't remount the client tree, so this effect does not
 * re-fire after the refresh completes.
 * @returns null (renders nothing)
 * @called-by app/page.tsx
 */
export function HomeRefresh() {
  const router = useRouter()
  useEffect(() => {
    router.refresh()
  }, [router])
  return null
}
