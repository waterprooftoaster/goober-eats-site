/**
 * @file surface.tsx
 * @description Tinted background container — the redesign's replacement for shadcn's Card.
 *   Borderless by default to honor the `.impeccable.md` "minimal chrome" principle.
 *   Carries the GLOBAL-SURFACE catalog testid.
 *   Called by: app/loading.tsx, app/error.tsx, app/not-found.tsx, future page craft passes
 * @dependencies radix-ui (Slot), class-variance-authority
 */

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const surfaceVariants = cva("rounded-lg", {
  variants: {
    tone: {
      subtle: "bg-card text-card-foreground",
      muted: "bg-secondary text-secondary-foreground",
    },
    padding: {
      none: "p-0",
      sm: "p-3",
      md: "p-5",
      lg: "p-8",
    },
  },
  defaultVariants: {
    tone: "subtle",
    padding: "md",
  },
})

export interface SurfaceProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof surfaceVariants> {
  asChild?: boolean
}

export function Surface({
  className,
  tone = "subtle",
  padding = "md",
  asChild = false,
  ...props
}: SurfaceProps) {
  const Comp = asChild ? Slot.Root : "div"
  return (
    <Comp
      data-slot="surface"
      data-testid="surface"
      data-tone={tone}
      className={cn(surfaceVariants({ tone, padding }), className)}
      {...props}
    />
  )
}

export { surfaceVariants }
