/**
 * @file not-found.tsx
 * @description Global 404 page rendered by Next.js when no route matches.
 *   Called by: Next.js App Router not-found contract
 * @dependencies components/ui/surface.tsx, components/ui/button.tsx
 */

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Surface } from "@/components/ui/surface"

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-16">
      <Surface tone="muted" padding="lg" className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t find the page you&apos;re looking for.
        </p>
        <div className="mt-2">
          <Button asChild variant="primary">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </Surface>
    </div>
  )
}
