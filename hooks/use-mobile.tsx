/**
 * @file use-mobile.tsx
 * @description SSR-safe viewport hook backed by useSyncExternalStore. Returns
 *   `false` on the server and during the first client render (eliminating the
 *   hydration mismatch the previous useState(undefined) → !!isMobile pattern
 *   could surface), then transitions to the real matchMedia value on the next
 *   commit. Mobile breakpoint is fixed at 768px (Tailwind's `md`).
 *   Called by: components/chat-panel/chat-panel.tsx
 */

import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Returns true when the viewport is below the mobile breakpoint.
 * Subscribes to matchMedia so changes (window resize, orientation flip)
 * trigger a re-render. SSR-safe: getServerSnapshot returns the desktop
 * default so the server-rendered HTML matches the first client paint;
 * a real-mobile client transitions to true on the very next commit.
 * @returns Boolean reflecting whether the viewport currently matches mobile
 * @called-by components/chat-panel/chat-panel.tsx
 */
export function useIsMobile(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

// --- Helpers ---

// Lazily initialized module-scope MediaQueryList so subscribe() and getSnapshot()
// reference the SAME object. Without the cache, React reads .matches from one
// MQL while listening for change events on another — spec-allowed but fragile.
let cachedMql: MediaQueryList | null = null

function getMql(): MediaQueryList | null {
  if (typeof window === "undefined") return null
  if (cachedMql === null) cachedMql = window.matchMedia(MOBILE_QUERY)
  return cachedMql
}

function subscribe(onStoreChange: () => void): () => void {
  const mql = getMql()
  if (!mql) return () => {}
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getSnapshot(): boolean {
  return getMql()?.matches ?? false
}

function getServerSnapshot(): boolean {
  return false
}
