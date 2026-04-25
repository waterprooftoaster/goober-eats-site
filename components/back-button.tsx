'use client'

/**
 * @file back-button.tsx
 * @description Small client button that calls router.back() to navigate to the previous page.
 *   Called by: app/checkout/page.tsx
 */

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/**
 * Renders a circular arrow-left button that navigates back in the browser history.
 * @called-by app/checkout/page.tsx
 */
export function BackButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      aria-label="Go back"
      onClick={() => router.back()}
      className="flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  )
}
