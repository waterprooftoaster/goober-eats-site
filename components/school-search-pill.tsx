/**
 * @file school-search-pill.tsx
 * @description Thin client wrapper around SearchPill for school selection.
 *   Exists because Server Components cannot pass arrow functions across the
 *   server→client boundary — getLabel is baked in here; all other display
 *   props are forwarded from the caller.
 *   Called by: components/cover-page.tsx (HeroSection)
 * @dependencies components/school-pill.tsx
 */

'use client'

import SearchPill from '@/components/school-pill'

interface School {
    id: string
    name: string
}

interface SchoolSearchPillProps {
    schools: School[]
    ctaHref: string
    ctaColor?: string
    ctaArrowColor?: string
    placeholder?: string
    maxItems?: number
    emptyMessage?: string
    noResultsMessage?: string
}

/**
 * Renders SearchPill for school selection with getLabel baked in.
 * @param schools - List of schools to display in the dropdown
 * @param ctaHref - URL the arrow button navigates to
 * @param ctaColor - Hex color for the circle button background
 * @param placeholder - Input placeholder text
 * @param maxItems - Max number of items shown in the dropdown
 * @param emptyMessage - Message when schools list is empty
 * @param noResultsMessage - Message when search query has no matches
 * @called-by components/cover-page.tsx HeroSection
 */
export default function SchoolSearchPill({
    schools,
    ctaHref,
    ctaColor,
    ctaArrowColor,
    placeholder,
    maxItems,
    emptyMessage,
    noResultsMessage,
}: SchoolSearchPillProps) {
    return (
        <SearchPill
            items={schools}
            getLabel={(s) => s.name}
            ctaHref={ctaHref}
            ctaColor={ctaColor}
            ctaArrowColor={ctaArrowColor}
            placeholder={placeholder}
            maxItems={maxItems}
            emptyMessage={emptyMessage}
            noResultsMessage={noResultsMessage}
        />
    )
}
