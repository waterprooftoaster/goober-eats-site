/**
 * @file screenshot-gallery.tsx
 * @description Thumbnail strip with a full-screen lightbox for cart screenshots.
 *   Called by: app/swiper/orders/pending-orders-list.tsx
 */

'use client'

import { useState } from 'react'
import Image from 'next/image'

interface ScreenshotGalleryProps {
  urls: string[]
}

/**
 * Renders a horizontal thumbnail strip; clicking a thumbnail opens a lightbox with prev/next navigation.
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
      <div className="flex overflow-x-auto gap-2 pb-1">
        {urls.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSelectedIndex(i)}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50 hover:opacity-90"
          >
            <Image src={url} alt={`Screenshot ${i + 1}`} fill className="object-cover" />
          </button>
        ))}
      </div>

      {selectedIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Escape') setSelectedIndex(null) }}
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center outline-none"
        >
          <button
            type="button"
            aria-label="Close gallery"
            onClick={() => setSelectedIndex(null)}
            className="absolute inset-0 w-full h-full"
          />

          <div className="relative z-10 max-w-screen-sm w-full flex items-center justify-center px-12">
            <div className="relative w-full h-[80vh]">
              <Image
                src={urls[selectedIndex]}
                alt={`Screenshot ${selectedIndex + 1}`}
                fill
                sizes="100vw"
                className="object-contain rounded-lg"
              />
            </div>
          </div>

          {urls.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous screenshot"
                onClick={(e) => { e.stopPropagation(); prev() }}
                className="absolute left-4 z-20 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next screenshot"
                onClick={(e) => { e.stopPropagation(); next() }}
                className="absolute right-4 z-20 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
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
