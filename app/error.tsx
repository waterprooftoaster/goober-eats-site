"use client"

/**
 * @file error.tsx
 * @description Global error boundary rendered by Next.js when a route segment throws and no
 *   colocated error.tsx is present. Sanitizes the error message and offers retry + home actions.
 *   Called by: Next.js App Router error boundary contract
 * @dependencies components/ui/surface.tsx, components/ui/button.tsx
 */

import Link from "next/link"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Surface } from "@/components/ui/surface"

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      console.error(error)
    }
  }, [error])

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-16">
      <Surface tone="muted" padding="lg" className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          {sanitize(error.message) || "An unexpected error occurred. Please try again."}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
        {error.digest ? (
          <p className="text-xs text-muted-foreground/80">Reference: {error.digest}</p>
        ) : null}
      </Surface>
    </div>
  )
}

// --- Helpers ---

function sanitize(message: string): string {
  if (!message) return ""
  // Drop file paths and stack-trace fragments — never surface internals to end users.
  return message
    .replace(/\s+at\s+.+/g, "")
    .replace(/\b\/[^\s]+/g, "")
    .trim()
    .slice(0, 240)
}
