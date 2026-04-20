/**
 * @file menu-item-card.tsx
 * @description Menu item card showing a square image, name, and optional strikethrough/discounted price.
 *   Called by: components/menu-grid.tsx
 */

import Image from 'next/image'

interface MenuItemCardProps {
  name: string
  originalPriceCents: number
  marketPriceCents: number | null
  imageUrl: string | null
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Renders a menu item with a square image, name, and price (strikethrough + market if discounted).
 * @param name - Display name of the menu item
 * @param originalPriceCents - Full price the swiper pays; shown with strikethrough when discounted
 * @param marketPriceCents - Discounted orderer price; null means no discount applies
 * @param imageUrl - Square image URL, or null for a gray placeholder
 * @called-by components/menu-grid.tsx
 */
export function MenuItemCard({
  name,
  originalPriceCents,
  marketPriceCents,
  imageUrl,
}: MenuItemCardProps) {
  const isDiscounted = marketPriceCents !== null

  return (
    <div data-testid="menu-item-card" className="flex flex-col">
      {/* Square image */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gray-200">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        )}
      </div>

      {/* Item name */}
      <p className="mt-1.5 truncate text-sm font-bold text-gray-900">{name}</p>

      {/* Price */}
      <div className="mt-0.5 flex items-center gap-1.5">
        {isDiscounted ? (
          <>
            <span
              data-testid="price-original"
              className="text-xs text-gray-400 line-through"
            >
              {formatPrice(originalPriceCents)}
            </span>
            <span data-testid="price-market" className="text-sm font-medium text-gray-900">
              {formatPrice(marketPriceCents!)}
            </span>
          </>
        ) : (
          <span data-testid="price-current" className="text-sm text-gray-900">
            {formatPrice(originalPriceCents)}
          </span>
        )}
      </div>
    </div>
  )
}
