'use client'

/**
 * @file cart-screenshot-lightbox.tsx
 * @description Fullscreen native <dialog> that displays a single cart screenshot.
 *   Controlled declaratively via the `open` prop; closes via the top-right X
 *   button, by tapping the dimmed area outside the image, or via ESC. The
 *   parent owns the open-state and is notified through `onClose`.
 *   Called by: components/chat/chat-view.tsx
 * @dependencies lucide-react (X icon)
 */

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  url: string | null
}

/**
 * Renders a fullscreen lightbox dialog over the cart screenshot.
 * @param open - Whether the dialog should be shown (parent-controlled)
 * @param onClose - Invoked when the dialog closes (X, backdrop, or ESC)
 * @param url - Image URL to display, or null to render an empty backdrop
 * @returns A native <dialog> element that mirrors the `open` prop
 * @called-by components/chat/chat-view.tsx
 */
export default function CartScreenshotLightbox({ open, onClose, url }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
    return () => {
      // If the component unmounts while the dialog is still open (e.g., parent
      // hides the lightbox by passing a null url), close it so we don't leak a
      // top-layer overlay with no way to dismiss it.
      if (dialog.open) dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handler = () => onClose()
    dialog.addEventListener('close', handler)
    return () => dialog.removeEventListener('close', handler)
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      data-testid="cart-screenshot-lightbox"
      className="m-0 h-screen max-h-none w-screen max-w-none bg-transparent p-0 text-foreground backdrop:bg-black/85"
    >
      {/*
        Backdrop click lives on the inner div, not the <dialog>. The dialog is
        sized to fill the viewport, so the inner div intercepts every pointer
        event before it can reach the dialog node — `e.target === dialogNode`
        would never match. We close when the click target is this inner div
        itself (i.e., the user tapped empty space, not the image or the X).
      */}
      <div
        onClick={handleBackdropClick}
        data-testid="cart-screenshot-lightbox-backdrop"
        className="relative flex h-full w-full items-center justify-center"
      >
        <div className="absolute right-2 top-0 z-10 pt-[env(safe-area-inset-top)]">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            data-testid="cart-screenshot-lightbox-close"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- next/image adds remote-host config burden for a one-off lightbox; plain img is acceptable here.
          <img
            src={url}
            alt="Cart screenshot"
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
    </dialog>
  )
}

// --- Helpers ---

/**
 * Closes the dialog when the click target is the wrapper div itself (the dimmed
 * area outside the image and X button). The native 'close' event fires onClose
 * via the effect listener.
 * @called-by CartScreenshotLightbox
 */
function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
  if (e.target !== e.currentTarget) return
  const dialog = e.currentTarget.closest('dialog') as HTMLDialogElement | null
  dialog?.close()
}

/**
 * Closes the nearest ancestor dialog. Walks up via closest('dialog') so the X
 * button does not need a direct ref to the dialog.
 * @called-by CartScreenshotLightbox
 */
function handleClose(e: React.MouseEvent<HTMLButtonElement>) {
  const dialog = e.currentTarget.closest('dialog') as HTMLDialogElement | null
  dialog?.close()
}
