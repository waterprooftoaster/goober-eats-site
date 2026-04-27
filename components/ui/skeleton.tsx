/**
 * @file skeleton.tsx
 * @description Shimmerless block placeholder honoring `prefers-reduced-motion`.
 *   Carries the GLOBAL-SKELETON catalog testid.
 *   Called by: app/loading.tsx, future loading boundaries in S04+
 * @dependencies (none beyond Tailwind utilities)
 */

import * as React from "react"

import { cn } from "@/lib/utils"

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      data-testid="skeleton"
      role="presentation"
      aria-hidden="true"
      className={cn(
        "rounded-md bg-secondary animate-pulse motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}
