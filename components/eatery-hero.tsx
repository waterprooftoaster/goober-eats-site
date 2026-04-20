/**
 * @file eatery-hero.tsx
 * @description Wide hero image component for the eatery detail page.
 *   Called by: app/eatery/[id]/page.tsx
 */

import Image from 'next/image'

interface EateryHeroProps {
  imageUrl: string | null
  alt: string
}

/**
 * Renders a 16:6 aspect-ratio hero image with a gray placeholder when no URL is provided.
 * @param imageUrl - URL of the hero image, or null to show the placeholder
 * @param alt - Accessible alt text for the image
 * @called-by app/eatery/[id]/page.tsx
 */
export function EateryHero({ imageUrl, alt }: EateryHeroProps) {
  return (
    <div className="relative aspect-[16/6] w-full overflow-hidden rounded-xl bg-gray-200">
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
      )}
    </div>
  )
}
