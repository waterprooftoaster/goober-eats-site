'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Dialog } from '@base-ui/react'
import { X } from 'lucide-react'
import { MenuItemOptionGroup, type OptionGroupWithOptions } from '@/components/menu-item-option-group'
import type { MenuItem } from '@/lib/types/database'

type ModalItem = Pick<MenuItem, 'id' | 'name' | 'image_url'>

interface Props {
  item: ModalItem | null
  onClose: () => void
}

type SelectedOptions = Record<string, string | string[]>

function buildDefaultSelections(groups: OptionGroupWithOptions[]): SelectedOptions {
  return groups.reduce<SelectedOptions>((acc, group) => {
    if (group.selection_type === 'single') {
      const def = group.options.find((o) => o.is_default)
      return { ...acc, [group.id]: def?.id ?? '' }
    }
    const defaults = group.options.filter((o) => o.is_default).map((o) => o.id)
    return { ...acc, [group.id]: defaults }
  }, {})
}

export function MenuItemDetailModal({ item, onClose }: Props) {
  const [groups, setGroups] = useState<OptionGroupWithOptions[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>({})
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // The parent keys this component on item.id (see menu-grid.tsx), so it remounts
  // fresh whenever the selected item changes — no synchronous reset needed here.
  useEffect(() => {
    if (!item) return
    fetch(`/api/menu-items/${item.id}/options`)
      .then((res) => res.json())
      .then((data: { groups: OptionGroupWithOptions[] }) => {
        setGroups(data.groups)
        setSelectedOptions(buildDefaultSelections(data.groups))
      })
      .finally(() => setLoading(false))
  }, [item])

  function handleOptionChange(groupId: string, value: string | string[]) {
    setSelectedOptions((prev) => ({ ...prev, [groupId]: value }))
  }

  async function handleAddToCart() {
    if (!item) return
    setAdding(true)
    setAddError(null)
    const flatOptions = Object.values(selectedOptions).flat().filter((id) => id !== '')
    try {
      const res = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu_item_id: item.id, selected_options: flatOptions }),
      })
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('cart-updated'))
        onClose()
      } else {
        const data = await res.json()
        setAddError(data.error ?? 'Failed to add to cart')
        setAdding(false)
      }
    } catch {
      setAddError('Network error — please try again')
      setAdding(false)
    }
  }

  if (!item) return null

  return (
    <Dialog.Root
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup
          role="dialog"
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-xl"
        >
          {/* Close button */}
          <Dialog.Close
            aria-label="Close"
            className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow hover:bg-white"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>

          <div className="flex flex-col sm:grid sm:grid-cols-2">
            {/* Left: square image */}
            <div className="relative aspect-square w-full">
              <Image
                src={item.image_url ?? '/placeholder-food.jpg'}
                alt={item.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 50vw"
              />
            </div>

            {/* Right: item info + scrollable options */}
            <div className="flex max-h-[60vh] flex-col sm:max-h-[500px]">
              <div className="p-4 pb-0">
                <h2 className="text-xl font-bold text-gray-900">{item.name}</h2>
              </div>

              <div className="flex-1 overflow-y-auto px-4">
                {loading && (
                  <div data-testid="options-loading" className="py-8 text-center text-sm text-gray-400">
                    Loading options…
                  </div>
                )}

                {!loading && groups !== null && groups.length > 0 && (
                  <div className="divide-y divide-gray-100">
                    {groups.map((group) => (
                      <MenuItemOptionGroup
                        key={group.id}
                        group={group}
                        selectedValue={selectedOptions[group.id] ?? (group.selection_type === 'single' ? '' : [])}
                        onChange={handleOptionChange}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Add to Cart — persistent at bottom */}
              <div className="p-4 pt-2">
                {addError && (
                  <p className="mb-2 text-center text-xs text-red-600">{addError}</p>
                )}
                <button
                  type="button"
                  disabled={adding}
                  onClick={handleAddToCart}
                  className="w-full rounded-none bg-black py-3 text-sm font-semibold text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {adding ? 'Adding…' : 'Add to Cart'}
                </button>
              </div>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
