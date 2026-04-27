/**
 * @file school-search-pill.tsx
 * @description Thin client wrapper around SearchPill for school selection.
 *   Exists because Server Components cannot pass arrow functions across the
 *   server→client boundary — getLabel is baked in here; all other display
 *   props are forwarded from the caller. Tracks selected school in local state
 *   so onNavigate can persist the school_id to sessionStorage before routing.
 *   Called by: components/cover-page.tsx (HeroSection)
 * @dependencies components/school-pill.tsx, lib/constants.ts
 */

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import SearchPill from '@/components/school-pill'
import { PENDING_SCHOOL_ID_KEY } from '@/lib/constants'

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
 * Renders SearchPill for school selection with getLabel baked in and sessionStorage persistence on navigate.
 * @param schools - List of schools to display in the dropdown
 * @param ctaHref - URL to push to after persisting the selected school_id
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
    const router = useRouter()
    const [selectedId, setSelectedId] = useState<string | null>(null)

    /**
     * Tracks the selected school ID so onNavigate can persist it.
     * @param school - The school the user selected from the dropdown
     * @called-by SearchPill onSelect
     */
    const handleSelect = useCallback((school: School) => {
        setSelectedId(school.id)
    }, [])

    /**
     * Persists the selected school ID to sessionStorage then navigates to ctaHref.
     * @called-by SearchPill onNavigate (arrow button click)
     */
    const handleNavigate = useCallback(() => {
        if (!selectedId) return
        sessionStorage.setItem(PENDING_SCHOOL_ID_KEY, selectedId)
        router.push(ctaHref)
    }, [selectedId, ctaHref, router])

    return (
        <SearchPill
            items={schools}
            getLabel={(s) => s.name}
            onSelect={handleSelect}
            onNavigate={handleNavigate}
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
