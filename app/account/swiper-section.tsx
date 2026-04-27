'use client'

/**
 * @file swiper-section.tsx
 * @description Account modal's swiper-aware section. Two branches:
 *   non-swiper sees a "Become a swiper" CTA → /swiper-registration; active
 *   swiper sees school management (Combobox) and Stripe Connect status +
 *   dashboard/relink controls. PATCH /api/profile for school changes;
 *   POST /api/stripe/connect for relink (pending state); POST
 *   /api/stripe/connect/dashboard for the Express login link (active state).
 *   Called by: components/account-panel.tsx
 * @dependencies components/ui/{button,combobox}
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

interface SwiperSectionProps {
  profile: { is_swiper: boolean; school_id: string | null }
  stripeAccount: { onboarding_complete: boolean } | null
  schools: School[]
}

/**
 * Branches on `profile.is_swiper` to either show the "Become a swiper" CTA
 * or the active-swiper management UI.
 * @returns Either the CTA or `<SwiperStatus />`
 * @called-by components/account-panel.tsx
 */
export function SwiperSection({ profile, stripeAccount, schools }: SwiperSectionProps) {
  if (profile.is_swiper) {
    return (
      <SwiperStatus
        profile={profile}
        stripeConnected={stripeAccount?.onboarding_complete === true}
        schools={schools}
      />
    )
  }
  return (
    <div className="mt-6 border-t border-border pt-6">
      <h2 className="text-lg font-semibold">Become a swiper</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Fulfill orders using your meal plan and earn money per delivery.
      </p>
      <Button
        variant="primary"
        size="default"
        asChild
        className="mt-4"
      >
        <Link href="/swiper-registration" data-testid="account-become-swiper-cta">
          Get started
        </Link>
      </Button>
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
 * @called-by SwiperStatus
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

interface SwiperStatusProps {
  profile: { school_id: string | null }
  stripeConnected: boolean
  schools: School[]
}

/**
 * Active-swiper management: school Combobox and Stripe Connect controls.
 * @returns The status + management surface for the active-swiper branch
 * @called-by SwiperSection
 */
function SwiperStatus({ profile, stripeConnected, schools }: SwiperStatusProps) {
  const router = useRouter()
  const currentSchool = schools.find((s) => s.id === profile.school_id) ?? null

  const [changingSchool, setChangingSchool] = useState(false)
  const [selectedSchool, setSelectedSchool] = useState<{ value: string; label: string } | null>(
    currentSchool ? { value: currentSchool.id, label: currentSchool.name } : null,
  )
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schoolSavedMsg, setSchoolSavedMsg] = useState(false)

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
      setChangingSchool(false)
      setSchoolSavedMsg(true)
      setTimeout(() => setSchoolSavedMsg(false), 3000)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStripeAction(endpoint: '/api/stripe/connect' | '/api/stripe/connect/dashboard') {
    setLinking(true)
    setError(null)
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Failed to open Stripe.')
        setLinking(false)
        return
      }
      const { url } = (await res.json()) as { url: string }
      window.location.href = url
    } catch {
      setError('Network error. Please try again.')
      setLinking(false)
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-5 border-t border-border pt-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Swiper</h2>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-foreground">
          Active
        </span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {schoolSavedMsg && (
        <p role="status" className="text-sm text-foreground/80">
          School saved.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">School</p>
        {!changingSchool ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{currentSchool?.name ?? '—'}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setChangingSchool(true)}
              className="-ml-2"
            >
              Change
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div data-testid="account-school-selector" className="flex-1">
              <Combobox
                value={selectedSchool}
                onValueChange={(value) => setSelectedSchool(asSchoolItem(value))}
                onInputValueChange={(inputValue) => setSchoolSearchQuery(inputValue)}
                isItemEqualToValue={(a, b) => a.value === b.value}
                autoHighlight
              >
                <ComboboxInput placeholder="Search schools…" className="h-10 text-sm" />
                <ComboboxContent>
                  <ComboboxList>
                    {schools.map((school) => (
                      <ComboboxItem
                        key={school.id}
                        value={{ value: school.id, label: school.name }}
                        className="py-2.5 text-sm"
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
              data-testid="account-school-save-button"
            >
              {saving ? 'Saving…' : 'Save school'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={() => setChangingSchool(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment account</p>
        {stripeConnected ? (
          <div className="flex items-center gap-3">
            <span
              data-testid="account-stripe-status"
              className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-foreground"
            >
              Connected
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleStripeAction('/api/stripe/connect/dashboard')}
              disabled={linking}
              data-testid="account-stripe-dashboard-button"
              className="-ml-2"
            >
              {linking ? 'Opening Stripe…' : 'Open dashboard'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span
              data-testid="account-stripe-status"
              className="self-start rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              Pending
            </span>
            <Button
              type="button"
              variant="primary"
              size="default"
              onClick={() => handleStripeAction('/api/stripe/connect')}
              disabled={linking}
              data-testid="account-stripe-link-button"
            >
              {linking ? 'Opening Stripe…' : 'Complete payment setup'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
