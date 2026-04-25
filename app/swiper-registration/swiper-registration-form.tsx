'use client'

/**
 * @file swiper-registration-form.tsx
 * @description Two-step swiper registration: school selection (Combobox)
 *   then POST /api/stripe/connect to launch Stripe Connect onboarding.
 *   Errors render inline (role="alert"). Combobox follows the auth-login
 *   dual-input pattern so Playwright disambiguation
 *   (getByTestId(...).getByRole('combobox')) keeps working.
 *   Called by: app/swiper-registration/page.tsx
 * @dependencies components/ui/{button,combobox}
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
  schools: School[]
}

/**
 * Renders the two-step swiper registration form (school → Stripe connect).
 * @param schoolId - Pre-set school id (already saved on the profile)
 * @param schoolName - Display name for the pre-set school
 * @param schools - Schools available for selection
 * @returns Form element with school selector and Stripe-continue CTA
 * @called-by app/swiper-registration/page.tsx
 */
export function SwiperRegistrationForm({ schoolId, schoolName, schools }: Props) {
  const [selectedSchool, setSelectedSchool] = useState<{ value: string; label: string } | null>(
    schoolId && schoolName ? { value: schoolId, label: schoolName } : null,
  )
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('')
  const [schoolConfirmed, setSchoolConfirmed] = useState(schoolId !== null)
  const [confirmedName, setConfirmedName] = useState(schoolName)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSaveSchool() {
    if (!selectedSchool) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: selectedSchool.value }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Failed to save school.')
        return
      }
      setConfirmedName(selectedSchool.label)
      setSchoolConfirmed(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleContinue() {
    setConnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Failed to set up payment account.')
        setConnecting(false)
        return
      }
      const { url } = (await res.json()) as { url: string }
      window.location.href = url
    } catch {
      setError('Network error. Please try again.')
      setConnecting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Become a swiper.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fulfill orders using your meal plan and earn money per delivery.
        </p>
      </header>

      {error && (
        <p
          data-testid="swiper-reg-error-message"
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Your school</p>
        {schoolConfirmed ? (
          <p className="text-sm">{confirmedName}</p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div data-testid="swiper-reg-school-selector" className="flex-1">
              <Combobox
                value={selectedSchool}
                onValueChange={(value) =>
                  setSelectedSchool(value as { value: string; label: string } | null)
                }
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
            <Button
              type="button"
              variant="subtle"
              size="default"
              onClick={handleSaveSchool}
              disabled={saving || !selectedSchool}
              data-testid="swiper-reg-save-button"
            >
              {saving ? 'Saving…' : 'Save school'}
            </Button>
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={handleContinue}
        disabled={!schoolConfirmed || connecting}
        data-testid="swiper-reg-continue-button"
        className="w-full"
      >
        {connecting ? 'Opening Stripe…' : 'Continue to payment setup'}
      </Button>
    </div>
  )
}
