'use client'

/**
 * @file swiper-registration-form.tsx
 * @description Single-page swiper registration: school selection + name, then a POST
 *   /api/stripe/connect to launch Stripe Connect onboarding. Both fields are saved in
 *   one PATCH /api/profile call before the Stripe redirect.
 *   Called by: app/swiper-registration/page.tsx
 * @dependencies components/ui/{combobox,input,stateful-button}
 */

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { StatefulButton } from '@/components/ui/stateful-button'
import {
    Combobox,
    ComboboxInput,
    ComboboxContent,
    ComboboxList,
    ComboboxItem,
    ComboboxEmpty,
} from '@/components/ui/combobox'

interface School {
    id: string
    name: string
}

interface Props {
    schoolId: string | null
    schoolName: string | null
    fullName: string | null
    schools: School[]
}

/**
 * Renders the single-page swiper registration form (school + name → Stripe connect).
 * @param schoolId - Pre-set school id (already saved on the profile)
 * @param schoolName - Display name for the pre-set school
 * @param fullName - Current full name on the profile (pre-fills the name input)
 * @param schools - Schools available for selection
 * @returns Registration form
 * @called-by app/swiper-registration/page.tsx
 */
export function SwiperRegistrationForm({ schoolId, schoolName, fullName: initialFullName, schools }: Props) {
    const [selectedSchool, setSelectedSchool] = useState<{ value: string; label: string } | null>(
        schoolId && schoolName ? { value: schoolId, label: schoolName } : null,
    )
    const [schoolSearchQuery, setSchoolSearchQuery] = useState('')
    const [fullName, setFullName] = useState(initialFullName ?? '')
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit() {
        if (!selectedSchool) return
        setError(null)
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ school_id: selectedSchool.value, full_name: fullName.trim() }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                setError((body as { error?: string }).error ?? 'Failed to save profile.')
                return
            }
            const stripeRes = await fetch('/api/stripe/connect', { method: 'POST' })
            if (!stripeRes.ok) {
                const body = await stripeRes.json().catch(() => ({}))
                setError((body as { error?: string }).error ?? 'Failed to set up payment account.')
                return
            }
            const { url } = (await stripeRes.json()) as { url: string }
            window.location.href = url
        } catch {
            setError('Network error. Please try again.')
        }
    }

    return (
        <div className="flex flex-col gap-6">
            {error && (
                <p
                    data-testid="swiper-reg-error-message"
                    role="alert"
                    className="text-sm text-destructive"
                >
                    {error}
                </p>
            )}

            <header>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    Become a swiper.
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Fulfill orders using your meal plan and earn money per delivery.
                </p>
            </header>

            <div data-testid="swiper-reg-school-selector">
                <Combobox
                    value={selectedSchool}
                    onValueChange={(value) => setSelectedSchool(asSchoolItem(value))}
                    onInputValueChange={(inputValue) => setSchoolSearchQuery(inputValue)}
                    isItemEqualToValue={(a, b) => a.value === b.value}
                    autoHighlight
                >
                    <ComboboxInput
                        placeholder="Search schools…"
                        className="h-11 text-base"
                    />
                    <ComboboxContent>
                        <ComboboxList>
                            {schools.map((school) => (
                                <ComboboxItem
                                    key={school.id}
                                    value={{ value: school.id, label: school.name }}
                                    className="py-3 text-base"
                                >
                                    {school.name}
                                </ComboboxItem>
                            ))}
                            {schoolSearchQuery.trim().length > 0 && (
                                <ComboboxEmpty>No schools found</ComboboxEmpty>
                            )}
                        </ComboboxList>
                    </ComboboxContent>
                </Combobox>
            </div>

            <Input
                type="text"
                placeholder="Your GrubHub name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && selectedSchool && fullName.trim()) {
                        e.preventDefault()
                        handleSubmit()
                    }
                }}
                maxLength={100}
                data-testid="swiper-reg-name-input"
                autoComplete="name"
                className="h-11"
            />

            <StatefulButton
                type="button"
                onClick={handleSubmit}
                disabled={!selectedSchool || !fullName.trim()}
                showFinishState={false}
                data-testid="swiper-reg-continue-button"
                className="w-full"
                bgColor="#2d2d2d"
                ringColor="#555555"
            >
                <span className="flex items-center gap-1.5">
                    Set Up Payment with <StripeWordmark />
                </span>
            </StatefulButton>
        </div>
    )
}

// --- Helpers ---

/**
 * Narrows the unknown value emitted by Combobox.onValueChange into the
 * `{ value, label }` shape this form consumes. Returns null on any other
 * shape so a primitive API drift cannot silently corrupt selectedSchool.
 * @param raw - The value emitted by Combobox onValueChange
 * @returns The narrowed school item, or null
 * @called-by SwiperRegistrationForm
 */
function asSchoolItem(raw: unknown): { value: string; label: string } | null {
    if (
        raw !== null &&
        typeof raw === 'object' &&
        'value' in raw &&
        'label' in raw &&
        typeof (raw as { value: unknown }).value === 'string' &&
        typeof (raw as { label: unknown }).label === 'string'
    ) {
        return raw as { value: string; label: string }
    }
    return null
}

/**
 * Stripe wordmark as an inline SVG sized to match body text.
 * fill="currentColor" lets it inherit the button's white text color.
 * @called-by SwiperRegistrationForm
 */
function StripeWordmark() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="16 12 88 32"
            style={{ height: '18px', width: 'auto', overflow: 'visible' }}
            fill="#6772e5"
            aria-label="Stripe"
            role="img"
        >
            <path fillRule="evenodd" d="M101.547 30.94c0-5.885-2.85-10.53-8.3-10.53-5.47 0-8.782 4.644-8.782 10.483 0 6.92 3.908 10.414 9.517 10.414 2.736 0 4.805-.62 6.368-1.494v-4.598c-1.563.782-3.356 1.264-5.632 1.264-2.23 0-4.207-.782-4.46-3.494h11.24c0-.3.046-1.494.046-2.046zM90.2 28.757c0-2.598 1.586-3.678 3.035-3.678 1.402 0 2.897 1.08 2.897 3.678zm-14.597-8.345c-2.253 0-3.7 1.057-4.506 1.793l-.3-1.425H65.73v26.805l5.747-1.218.023-6.506c.828.598 2.046 1.448 4.07 1.448 4.115 0 7.862-3.3 7.862-10.598-.023-6.667-3.816-10.3-7.84-10.3zm-1.38 15.84c-1.356 0-2.16-.483-2.713-1.08l-.023-8.53c.598-.667 1.425-1.126 2.736-1.126 2.092 0 3.54 2.345 3.54 5.356 0 3.08-1.425 5.38-3.54 5.38zm-16.4-17.196l5.77-1.24V13.15l-5.77 1.218zm0 1.747h5.77v20.115h-5.77zm-6.185 1.7l-.368-1.7h-4.966V40.92h5.747V27.286c1.356-1.77 3.655-1.448 4.368-1.195v-5.287c-.736-.276-3.425-.782-4.782 1.7zm-11.494-6.7L34.535 17l-.023 18.414c0 3.402 2.552 5.908 5.954 5.908 1.885 0 3.264-.345 4.023-.76v-4.667c-.736.3-4.368 1.356-4.368-2.046V25.7h4.368v-4.897h-4.37zm-15.54 10.828c0-.897.736-1.24 1.954-1.24a12.85 12.85 0 0 1 5.7 1.47V21.47c-1.908-.76-3.793-1.057-5.7-1.057-4.667 0-7.77 2.437-7.77 6.506 0 6.345 8.736 5.333 8.736 8.07 0 1.057-.92 1.402-2.207 1.402-1.908 0-4.345-.782-6.276-1.84v5.47c2.138.92 4.3 1.3 6.276 1.3 4.782 0 8.07-2.368 8.07-6.483-.023-6.85-8.782-5.632-8.782-8.207z" />
        </svg>
    )
}
