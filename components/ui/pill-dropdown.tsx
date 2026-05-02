"use client"

/**
 * @file pill-dropdown.tsx
 * @description Shared pill-style dropdown primitives: container, item row, and empty state.
 *   Called by: components/school-pill.tsx, components/ui/combobox.tsx
 */

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * White rounded dropdown container. Accepts className for positioning (pill) or structural
 * layout (combobox via Base UI render prop merge).
 * @called-by school-pill.tsx, combobox.tsx ComboboxContent
 */
function PillDropdownContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("bg-white rounded-sm shadow-lg overflow-hidden", className)}
      {...props}
    />
  )
}

/**
 * Single item row with pill typography and hover/active highlight.
 * Supports two highlight mechanisms:
 *   - `active` prop: used by school-pill's manually tracked highlighted/selected state
 *   - `data-highlighted` attribute: set by Base UI on keyboard-focused combobox items
 * @param active - Whether to apply the highlight background (pill usage)
 * @called-by school-pill.tsx, combobox.tsx ComboboxItem
 */
function PillDropdownItem({
  className,
  active,
  ...props
}: React.ComponentProps<"div"> & { active?: boolean }) {
  return (
    <div
      className={cn(
        "relative flex w-full items-center px-5 min-h-14 text-base text-black font-bold rounded cursor-pointer transition-colors hover:bg-foreground/15 data-[highlighted]:bg-foreground/15",
        active && "bg-foreground/15",
        className
      )}
      {...props}
    />
  )
}

/**
 * Empty / no-results row with muted pill typography.
 * @called-by school-pill.tsx, combobox.tsx ComboboxEmpty
 */
function PillDropdownEmpty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center px-5 min-h-14 text-base font-bold text-black/40",
        className
      )}
      {...props}
    />
  )
}

export { PillDropdownContent, PillDropdownItem, PillDropdownEmpty }
