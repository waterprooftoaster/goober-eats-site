/**
 * @file school-pill.tsx
 * @description Generic pill-shaped item selector + navigate CTA in a single unified container.
 *   Renders a full-width rounded pill with a custom listbox trigger on the left and a
 *   circle arrow button on the right. Accepts any list of items via generics.
 *   Called by: components/cover-page.tsx (HeroSection)
 * @dependencies lucide-react, next/link, lib/utils
 */

'use client'

import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
    PillDropdownContent,
    PillDropdownItem,
    PillDropdownEmpty,
} from '@/components/ui/pill-dropdown'

interface SearchPillItem {
    id: string
}

interface SearchPillProps<T extends SearchPillItem> {
    items: T[]
    getLabel: (item: T) => string
    onSelect?: (item: T) => void
    onNavigate?: () => void
    placeholder?: string
    maxItems?: number
    ctaHref: string
    ctaColor?: string
    ctaArrowColor?: string
    emptyMessage?: string
    noResultsMessage?: string
}

/**
 * Renders a unified pill-shaped item selector with an arrow-button CTA.
 * @param items - List of items to populate the custom listbox
 * @param getLabel - Returns the display label for an item
 * @param onSelect - Optional callback fired when an item is selected
 * @param onNavigate - When provided, renders the CTA as a button (disabled until an item is selected) and calls this instead of following ctaHref
 * @param placeholder - Placeholder text for the input (default: "Select…")
 * @param maxItems - If set, limits the number of items shown in the dropdown
 * @param ctaHref - URL the arrow button navigates to (unused when onNavigate is provided)
 * @param ctaColor - Hex color for the circle button background (default: "#000000")
 * @param emptyMessage - Message shown when items list is empty (default: "No options available")
 * @param noResultsMessage - Message shown when query has no matches (default: "No results found")
 * @returns A rounded pill with a custom dropdown and a circle CTA button
 * @called-by components/cover-page.tsx HeroSection
 */
export default function SearchPill<T extends SearchPillItem>({
    items,
    getLabel,
    onSelect,
    onNavigate,
    placeholder = 'Select…',
    maxItems,
    ctaHref,
    ctaColor,
    ctaArrowColor,
    emptyMessage = 'No options available',
    noResultsMessage = 'No results found',
}: SearchPillProps<T>) {
    const [open, setOpen] = useState(false)
    const [selected, setSelected] = useState<T | null>(null)
    const [query, setQuery] = useState('')
    const [highlighted, setHighlighted] = useState(-1)
    const containerRef = useRef<HTMLDivElement>(null)

    const filtered = query
        ? items.filter(item => getLabel(item).toLowerCase().includes(query.toLowerCase()))
        : items
    const filteredItems = maxItems !== undefined ? filtered.slice(0, maxItems) : filtered

    /**
     * Handles keyboard navigation and selection within the open dropdown.
     * @param e - Keyboard event from the search input
     * @called-by input onKeyDown
     */
    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!open) return
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlighted(h => Math.min(h + 1, filteredItems.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlighted(h => Math.max(h - 1, 0))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            const idx = highlighted >= 0 ? highlighted : 0
            const item = filteredItems[idx]
            if (item) {
                setSelected(item)
                setQuery('')
                setOpen(false)
                setHighlighted(-1)
                onSelect?.(item)
            }
        } else if (e.key === 'Escape') {
            setOpen(false)
            setHighlighted(-1)
        }
    }

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
                setHighlighted(-1)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={containerRef} className="relative">
            <div
                className={cn(
                    'flex items-center bg-white rounded-full shadow-lg py-1.5 pr-1.5 pl-5',
                )}
            >
                <div className="relative flex-1 flex items-center pr-6">
                    <input
                        type="text"
                        role="combobox"
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        aria-autocomplete="list"
                        aria-label={placeholder}
                        placeholder={placeholder}
                        value={open ? query : (selected ? getLabel(selected) : '')}
                        onChange={e => {
                            setQuery(e.target.value)
                            setHighlighted(-1)
                            if (!open) setOpen(true)
                        }}
                        onFocus={() => {
                            setQuery('')
                            setHighlighted(-1)
                            setOpen(true)
                        }}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-transparent border-none outline-none text-base font-bold text-black placeholder:text-black/40 cursor-text"
                    />
                    <ChevronDown
                        size={14}
                        className={cn(
                            'absolute right-1 top-1/2 -translate-y-1/2 text-black/40 transition-transform duration-150 pointer-events-none',
                            open && 'rotate-180',
                        )}
                    />
                </div>

                {onNavigate ? (
                    <button
                        type="button"
                        onClick={onNavigate}
                        disabled={selected === null}
                        aria-label="Continue"
                        className="flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <span
                            className="flex items-center justify-center w-11 h-11 rounded-full transition-transform duration-150 motion-safe:hover:scale-[1.06] motion-safe:active:scale-95"
                            style={{ backgroundColor: ctaColor ?? '#000000' }}
                        >
                            <ArrowRight size={18} style={{ color: ctaArrowColor ?? '#ffffff' }} />
                        </span>
                    </button>
                ) : (
                    <Link href={ctaHref} aria-label="Continue" className="flex-shrink-0">
                        <span
                            className="flex items-center justify-center w-11 h-11 rounded-full transition-transform duration-150 motion-safe:hover:scale-[1.06] motion-safe:active:scale-95"
                            style={{ backgroundColor: ctaColor ?? '#000000' }}
                        >
                            <ArrowRight size={18} style={{ color: ctaArrowColor ?? '#ffffff' }} />
                        </span>
                    </Link>
                )}
            </div>

            {open && (
                <PillDropdownContent
                    role="listbox"
                    aria-label="Options"
                    className="absolute top-full left-0 right-0 mt-3 z-50"
                >
                    {filteredItems.length === 0 ? (
                        <PillDropdownEmpty>
                            {query ? noResultsMessage : emptyMessage}
                        </PillDropdownEmpty>
                    ) : (
                        filteredItems.map((item, index) => (
                            <PillDropdownItem
                                key={item.id}
                                role="option"
                                aria-selected={selected?.id === item.id}
                                active={selected?.id === item.id || index === highlighted}
                                onMouseEnter={() => setHighlighted(-1)}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                    setSelected(item)
                                    setQuery('')
                                    setOpen(false)
                                    setHighlighted(-1)
                                    onSelect?.(item)
                                }}
                            >
                                {getLabel(item)}
                            </PillDropdownItem>
                        ))
                    )}
                </PillDropdownContent>
            )}
        </div>
    )
}
