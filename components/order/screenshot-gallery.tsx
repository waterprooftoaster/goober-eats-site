'use client'

/**
 * @file screenshot-gallery.tsx
 * @description Cart-screenshot thumbnail strip + lightbox. Tokens cascade
 *   to OKLCH-126; lightbox closes on Escape, prev/next nav and click-outside.
 *   Called by: app/swiper/orders/pending-orders-list.tsx
 * @dependencies next/image
 */

import { useState } from 'react'
import Image from 'next/image'

interface ScreenshotGalleryProps {
  urls: string[]
}

/**
 * Renders a horizontal thumbnail strip; clicking a thumbnail opens a
 * lightbox with prev/next navigation and Escape-to-close.
 * @param urls - Array of public screenshot URLs
 * @called-by app/swiper/orders/pending-orders-list.tsx
 */
export function ScreenshotGallery({ urls }: ScreenshotGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  if (!urls.length) return null

  function prev() {
    setSelectedIndex((i) => (i != null ? (i - 1 + urls.length) % urls.length : 0))
  }

  function next() {
    setSelectedIndex((i) => (i != null ? (i + 1) % urls.length : 0))
  }

  return (
    <>
      <div
        data-testid="swiper-screenshot-gallery"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {urls.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSelectedIndex(i)}
            aria-label={`Open screenshot ${i + 1}`}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted/40 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Image src={url} alt={`Screenshot ${i + 1}`} fill className="object-cover" />
          </button>
        ))}
      </div>

      {selectedIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cart screenshot"
          tabIndex={-1}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Escape') setSelectedIndex(null) }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 outline-none"
        >
          <button
            type="button"
            aria-label="Close gallery"
            onClick={() => setSelectedIndex(null)}
            className="absolute inset-0 h-full w-full"
          />
          <div className="relative z-10 flex w-full max-w-screen-sm items-center justify-center px-12">
            <div className="relative h-[80vh] w-full">
              <Image
                src={urls[selectedIndex]}
                alt={`Screenshot ${selectedIndex + 1}`}
                fill
                sizes="100vw"
                className="rounded-lg object-contain"
              />
            </div>
          </div>
          {urls.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous screenshot"
                onClick={(e) => { e.stopPropagation(); prev() }}
                className="absolute left-4 z-20 rounded-full bg-background/20 p-2 text-background hover:bg-background/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/40"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next screenshot"
                onClick={(e) => { e.stopPropagation(); next() }}
                className="absolute right-4 z-20 rounded-full bg-background/20 p-2 text-background hover:bg-background/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/40"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
