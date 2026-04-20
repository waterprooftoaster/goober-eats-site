'use client'

/**
 * @file menu-item-option-group.tsx
 * @description Renders a single option group as radio buttons (single) or checkboxes (multiple).
 *   Called by: components/menu-item-detail-modal.tsx
 * @dependencies @base-ui/react, lib/types/database.ts
 */

import { RadioGroup, Radio, Checkbox } from '@base-ui/react'
import { cn } from '@/lib/utils'
import type { MenuItemOptionGroup as OptionGroupType, MenuItemOption } from '@/lib/types/database'

export interface OptionGroupWithOptions extends OptionGroupType {
  options: MenuItemOption[]
}

interface Props {
  group: OptionGroupWithOptions
  selectedValue: string | string[]
  onChange: (groupId: string, value: string | string[]) => void
}

/**
 * Renders a labeled option group with radios for 'single' selection or checkboxes for 'multiple'.
 * @param group - Option group data including type, required flag, and available options
 * @param selectedValue - Currently selected option ID (single) or array of IDs (multiple)
 * @param onChange - Callback invoked with the group ID and new selection when the user picks an option
 * @called-by components/menu-item-detail-modal.tsx
 */
export function MenuItemOptionGroup({ group, selectedValue, onChange }: Props) {
  return (
    <div className="py-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-semibold text-gray-900">{group.name}</span>
        {group.is_required && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
            Required
          </span>
        )}
      </div>

      {group.selection_type === 'single' ? (
        <RadioGroup
          value={selectedValue as string}
          onValueChange={(value) => onChange(group.id, value)}
          className="flex flex-col gap-2"
        >
          {group.options.map((option) => (
            <label key={option.id} className="flex cursor-pointer items-center gap-3">
              <Radio.Root
                value={option.id}
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-gray-400',
                  'data-[checked]:border-black data-[checked]:bg-black'
                )}
              >
                <Radio.Indicator className="h-2 w-2 rounded-full bg-white" />
              </Radio.Root>
              <span className="text-sm text-gray-700">{option.name}</span>
              {option.additional_price_cents > 0 && (
                <span className="ml-auto text-sm text-gray-500">
                  +${(option.additional_price_cents / 100).toFixed(2)}
                </span>
              )}
            </label>
          ))}
        </RadioGroup>
      ) : (
        <div className="flex flex-col gap-2">
          {group.options.map((option) => {
            const checked = (selectedValue as string[]).includes(option.id)
            return (
              <label key={option.id} className="flex cursor-pointer items-center gap-3">
                <Checkbox.Root
                  checked={checked}
                  onCheckedChange={(isChecked) => {
                    const current = selectedValue as string[]
                    const next = isChecked
                      ? [...current, option.id]
                      : current.filter((id) => id !== option.id)
                    onChange(group.id, next)
                  }}
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-gray-400',
                    'data-[checked]:border-black data-[checked]:bg-black'
                  )}
                >
                  <Checkbox.Indicator className="text-white">
                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <span className="text-sm text-gray-700">{option.name}</span>
                {option.additional_price_cents > 0 && (
                  <span className="ml-auto text-sm text-gray-500">
                    +${(option.additional_price_cents / 100).toFixed(2)}
                  </span>
                )}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
