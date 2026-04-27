"use client"

/**
 * @file modal.tsx
 * @description Centered Radix Dialog wrapper for confirmations and route-modal patterns
 *   (e.g. /account, delete-account confirm). Fade + scale-in entrance gated by `motion-reduce:`.
 *   Carries the GLOBAL-MODAL catalog testid on the content node.
 *   Called by: account/delete-account flows in S06; any future centered-dialog use.
 * @dependencies radix-ui (Dialog), tw-animate-css for fade/zoom utilities
 */

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export const Modal = DialogPrimitive.Root
export const ModalTrigger = DialogPrimitive.Trigger
export const ModalClose = DialogPrimitive.Close
export const ModalPortal = DialogPrimitive.Portal

export function ModalOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="modal-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px]",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        "motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

export interface ModalContentProps
  extends React.ComponentProps<typeof DialogPrimitive.Content> {
  showClose?: boolean
}

export function ModalContent({
  className,
  children,
  showClose = true,
  ...props
}: ModalContentProps) {
  return (
    <ModalPortal>
      <ModalOverlay />
      <DialogPrimitive.Content
        data-slot="modal-content"
        data-testid="modal"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex w-full max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl bg-card p-6 text-card-foreground shadow-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "motion-reduce:animate-none motion-reduce:zoom-in-100 motion-reduce:zoom-out-100",
          className
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            data-slot="modal-close-button"
            aria-label="Close"
            className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </ModalPortal>
  )
}

export function ModalHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="modal-header"
      className={cn("flex flex-col gap-1.5 text-left", className)}
      {...props}
    />
  )
}

export function ModalFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="modal-footer"
      className={cn("mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

export function ModalTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="modal-title"
      className={cn("text-lg font-semibold tracking-tight", className)}
      {...props}
    />
  )
}

export function ModalDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="modal-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}
