/**
 * @file loading.tsx
 * @description Global Suspense fallback rendered by Next.js while a route segment streams.
 *   Uses the new Skeleton primitive; intentionally minimal per `.impeccable.md` "minimal chrome".
 *   Called by: Next.js App Router (any route without a colocated loading.tsx)
 * @dependencies components/ui/skeleton.tsx
 */

import { Skeleton } from "@/components/ui/skeleton"

export default function GlobalLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-12">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
      <div className="mt-6 flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}
