/**
 * @file banner-guard.tsx
 * @description Client wrapper that unmounts its children when not on the homepage.
 *   Handles the Next.js parallel route soft-navigation issue where slots retain
 *   their rendered state during client-side navigation.
 *   Called by: app/@banner/page.tsx
 */
'use client'

import { usePathname } from 'next/navigation'

interface BannerGuardProps {
  children: React.ReactNode
}

/**
 * Returns null (no DOM output) when the current pathname is not '/'.
 * @param children - The banner content to conditionally render
 * @called-by app/@banner/page.tsx
 */
export function BannerGuard({ children }: BannerGuardProps) {
  if (usePathname() !== '/') return null
  return <>{children}</>
}
