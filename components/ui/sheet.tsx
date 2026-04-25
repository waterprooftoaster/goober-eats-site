"use client"

/**
 * @file sheet.tsx
 * @description Bottom-sheet primitive backed by vaul (drag-to-dismiss + scrim +
 *   focus trap + scroll-lock + ESC). The S03 catalog row GLOBAL-SHEET specifies
 *   "Wraps Radix Dialog + drag-to-dismiss"; S07 implements the drag piece by
 *   migrating the underlying engine from Radix Dialog to vaul (vaul itself wraps
 *   Radix Dialog under the hood, so the focus-trap/scrim/ESC behavior is
 *   preserved). API surface unchanged: Sheet, SheetTrigger, SheetClose,
 *   SheetPortal, SheetOverlay, SheetContent, SheetHeader, SheetFooter,
 *   SheetTitle, SheetDescription. The catalog testid `sheet` lives on
 *   SheetContent.
 *   Called by: components/chat-panel/chat-panel.tsx (mobile newest-panel)
 * @dependencies vaul (drag drawer), tw-animate-css (vaul handles its own
 *   slide animation; tw-animate utilities here only retained on the overlay
 *   for fade)
 */

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export const Sheet = DrawerPrimitive.Root
export const SheetTrigger = DrawerPrimitive.Trigger
export const SheetClose = DrawerPrimitive.Close
export const SheetPortal = DrawerPrimitive.Portal

export function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]",
        className
      )}
      {...props}
    />
  )
}

export interface SheetContentProps
  extends React.ComponentProps<typeof DrawerPrimitive.Content> {
  showClose?: boolean
  /** Show the standard horizontal drag-handle pill at the top edge. Default true. */
  showHandle?: boolean
}

export function SheetContent({
  className,
  children,
  showClose = true,
  showHandle = true,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DrawerPrimitive.Content
        data-slot="sheet-content"
        data-testid="sheet"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col gap-4 rounded-t-2xl bg-card p-6 text-card-foreground shadow-lg",
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:max-w-md sm:max-h-screen sm:rounded-none sm:rounded-l-2xl",
          "outline-none focus-visible:outline-none",
          className
        )}
        {...props}
      >
        {showHandle && (
          <div
            aria-hidden
            data-slot="sheet-handle"
            className="mx-auto -mt-2 mb-1 h-1.5 w-12 flex-shrink-0 rounded-full bg-border"
          />
        )}
        {children}
        {showClose && (
          <DrawerPrimitive.Close
            data-slot="sheet-close-button"
            aria-label="Close"
            className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <XIcon className="size-4" />
          </DrawerPrimitive.Close>
        )}
      </DrawerPrimitive.Content>
    </SheetPortal>
  )
}

export function SheetHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 text-left", className)}
      {...props}
    />
  )
}

export function SheetFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-lg font-semibold tracking-tight", className)}
      {...props}
    />
  )
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}
