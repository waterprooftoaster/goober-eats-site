/**
 * @file total-input.tsx
 * @description Controlled dollar/cents input — displays as "$##.##", converts to integer cents on blur.
 *   Called by: app/order/new/order-new-form.tsx
 * @dependencies components/ui/input.tsx
 */

'use client'

import { useState, useId } from 'react'
import { Input } from '@/components/ui/input'

interface TotalInputProps {
  valueCents: number | null
  onChange: (cents: number | null) => void
  disabled?: boolean
}

/**
 * Dollar input that stores cents internally. Keeps raw display string during editing to avoid
 * mid-type stomping (e.g. "12." stays "12." until blur).
 * @param valueCents - Controlled value in integer cents (null = empty)
 * @param onChange - Called with cents on blur, or null if the value is empty/invalid/zero
 * @called-by app/order/new/order-new-form.tsx
 */
export function TotalInput({ valueCents, onChange, disabled }: TotalInputProps) {
  const id = useId()
  const [displayValue, setDisplayValue] = useState<string>(
    valueCents != null ? (valueCents / 100).toFixed(2) : ''
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Allow digits, one decimal point, and nothing else
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    setDisplayValue(raw)
  }

  function handleBlur() {
    const parsed = parseFloat(displayValue)
    if (!displayValue || isNaN(parsed) || parsed <= 0) {
      setDisplayValue('')
      onChange(null)
    } else {
      const cents = Math.round(parsed * 100)
      setDisplayValue((cents / 100).toFixed(2))
      onChange(cents)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-700 shrink-0">
        Total
      </label>
      <div className="relative flex items-center">
        <span className="absolute left-2.5 text-sm text-gray-500 pointer-events-none">$</span>
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          className="pl-6"
          aria-label="Total"
        />
      </div>
    </div>
  )
}
