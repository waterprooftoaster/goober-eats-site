'use client'

/**
 * @file menu-grid.tsx
 * @description Client component rendering menu item cards grouped by menu group, with a detail modal on click.
 *   Called by: app/eatery/[id]/page.tsx
 * @dependencies components/menu-item-card.tsx, components/menu-item-detail-modal.tsx
 */

import { useState } from 'react'
import { MenuItemCard } from '@/components/menu-item-card'
import { MenuItemDetailModal } from '@/components/menu-item-detail-modal'
import type { MenuGroupWithItems } from '@/lib/types/database'

type MenuGridItem = MenuGroupWithItems['items'][number]

interface Props {
  groups: MenuGroupWithItems[]
}

/**
 * Renders menu groups as labeled sections of item cards; opens a detail modal on item click.
 * @param groups - Menu groups with nested items from the get_menu_for_eatery RPC
 * @called-by app/eatery/[id]/page.tsx
 */
export function MenuGrid({ groups }: Props) {
  const [selectedItem, setSelectedItem] = useState<MenuGridItem | null>(null)

  return (
    <>
      <div data-testid="menu-grid" className="space-y-8 pb-10">
        {groups.map((group) => (
          <section key={group.id}>
            <h2 className="text-base font-bold text-gray-900 mb-3">{group.name}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="text-left"
                  onClick={() => setSelectedItem(item)}
                >
                  <MenuItemCard
                    name={item.name}
                    originalPriceCents={item.original_price_cents}
                    marketPriceCents={item.market_price_cents}
                    imageUrl={item.image_url}
                  />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <MenuItemDetailModal
        key={selectedItem?.id ?? 'empty'}
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </>
  )
}
