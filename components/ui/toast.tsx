"use client"

/**
 * @file toast.tsx
 * @description Lightweight toast primitive: ToastProvider mounts a portal-less list at the
 *   document edge; useToast() exposes a stable `toast(message, opts?)` invoker. Toasts
 *   auto-dismiss after `opts.duration ?? 4000`ms. Hand-rolled to avoid a new dependency
 *   (Radix Toast / Sonner). Carries the GLOBAL-TOAST catalog testid on the container.
 *   Called by: future optimistic-UI failure rollbacks (S04+); not mounted in app/layout.tsx in S03.
 * @dependencies (none beyond React + Tailwind)
 */

import * as React from "react"

import { cn } from "@/lib/utils"

type ToastVariant = "default" | "success" | "error"

interface ToastOptions {
  variant?: ToastVariant
  duration?: number
}

interface Toast {
  id: number
  message: string
  variant: ToastVariant
  duration: number
}

interface ToastContextValue {
  toast: (message: string, opts?: ToastOptions) => number
  dismiss: (id: number) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

let toastSeq = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const timersRef = React.useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const toast = React.useCallback(
    (message: string, opts: ToastOptions = {}) => {
      const id = ++toastSeq
      const next: Toast = {
        id,
        message,
        variant: opts.variant ?? "default",
        duration: opts.duration ?? 4000,
      }
      setToasts((current) => [...current, next])
      const timer = setTimeout(() => dismiss(id), next.duration)
      timersRef.current.set(id, timer)
      return id
    },
    [dismiss]
  )

  React.useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  const value = React.useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider />")
  }
  return ctx
}

// --- Helpers ---

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: number) => void
}) {
  return (
    <div
      data-slot="toast-container"
      data-testid="toast-container"
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:left-auto sm:right-4 sm:translate-x-0"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div
      role="status"
      data-slot="toast"
      data-variant={toast.variant}
      className={cn(
        "pointer-events-auto flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground shadow-md",
        "animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none motion-reduce:slide-in-from-bottom-0",
        toast.variant === "success" && "border-[--color-accent]/40",
        toast.variant === "error" && "border-destructive/40 text-destructive"
      )}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded-md px-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        ×
      </button>
    </div>
  )
}
