'use client'

/**
 * @file swiper-section.tsx
 * @description Client components for the swiper-specific section of the account page.
 *   Shows swiper status, school selector, and Stripe Connect link/relink controls.
 *   Surfaces a human-readable Stripe `disabled_reason` when the Connect
 *   account is not currently accepting transfers (finding #12).
 *   Called by: components/account-panel.tsx
 * @dependencies lib/stripe/account-state.ts (canAccept, humanReason)
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { canAccept, humanReason, type AccountState } from '@/lib/stripe/account-state'

type School = { id: string; name: string }

interface StripeAccountStatus {
  onboarding_complete: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  disabled_reason: string | null
  currently_due: string[]
}

type Props = {
  profile: { is_swiper: boolean; school_id: string | null }
  stripeAccount: StripeAccountStatus | null
  schools: School[]
}

/**
 * Renders swiper recruitment CTA for non-swipers, or SwiperStatus panel for active swipers.
 * @returns SwiperStatus panel or "Become a Swiper" CTA
 * @called-by components/account-panel.tsx
 */
export function SwiperSection({ profile, stripeAccount, schools }: Props) {
  if (profile.is_swiper) {
    const accountState: AccountState | null = stripeAccount
      ? {
          onboardingComplete: stripeAccount.onboarding_complete,
          chargesEnabled: stripeAccount.charges_enabled,
          payoutsEnabled: stripeAccount.payouts_enabled,
          disabledReason: stripeAccount.disabled_reason,
          currentlyDue: stripeAccount.currently_due,
        }
      : null

    return (
      <SwiperStatus
        profile={profile}
        accountState={accountState}
        schools={schools}
      />
    )
  }

  return (
    <div className="space-y-6">
      <hr className="border-gray-200" />
      <div>
        <h2 className="text-lg font-semibold mb-1">Become a Swiper</h2>
        <p className="text-sm text-gray-500 mb-4">
          Fulfill orders using your meal plan and earn $6 per item.
        </p>
        <Link
          href="/swiper-registration"
          className="inline-block rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800"
        >
          Get Started
        </Link>
      </div>
    </div>
  )
}

type SwiperStatusProps = {
  profile: { school_id: string | null }
  accountState: AccountState | null
  schools: School[]
}

/**
 * Renders the active swiper's school selector and Stripe Connect account status.
 *   When the Connect account is not accepting transfers, shows a plain-English
 *   disabled reason (via `humanReason`) alongside the pending pill.
 * @returns School and payment account management UI
 * @called-by SwiperSection
 */
function SwiperStatus({ profile, accountState, schools }: SwiperStatusProps) {
  const [changingSchool, setChangingSchool] = useState(false)
  const [schoolId, setSchoolId] = useState(profile.school_id ?? '')
  const [saving, setSaving] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schoolSavedMsg, setSchoolSavedMsg] = useState(false)
  const router = useRouter()

  const currentSchool = schools.find((s) => s.id === profile.school_id)
  const stripeReady = accountState !== null && canAccept(accountState)
  const disabledExplainer = accountState
    ? humanReason(accountState.disabledReason)
    : null

  async function handleSaveSchool() {
    if (!schoolId) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: schoolId }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Failed to save school')
      return
    }
    setChangingSchool(false)
    setSchoolSavedMsg(true)
    setTimeout(() => setSchoolSavedMsg(false), 3000)
    router.refresh()
  }

  async function handleRelinkPayment() {
    setLinking(true)
    setError(null)
    const res = await fetch('/api/stripe/connect', { method: 'POST' })
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Failed to get onboarding link')
      setLinking(false)
      return
    }
    const { url } = await res.json()
    window.location.href = url
  }

  return (
    <div className="space-y-6">
      <hr className="border-gray-200" />
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold">Swiper</h2>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            Active
          </span>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {schoolSavedMsg && <p className="text-sm text-green-600 mb-3">School saved</p>}

        {/* School */}
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-1">School</p>
          {!changingSchool ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{currentSchool?.name ?? '—'}</span>
              <button
                onClick={() => setChangingSchool(true)}
                className="text-sm text-gray-500 underline hover:text-gray-700"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                name="school_id"
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="">Select a school…</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSaveSchool}
                disabled={saving || !schoolId}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save School'}
              </button>
              <button
                onClick={() => setChangingSchool(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Stripe status */}
        <div>
          <p className="text-sm text-gray-500 mb-1">Payment account</p>
          {stripeReady ? (
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Connected
              </span>
              <button
                onClick={handleRelinkPayment}
                disabled={linking}
                className="text-sm text-gray-500 underline hover:text-gray-700 disabled:opacity-50"
              >
                {linking ? 'Opening Stripe…' : 'Update payment info'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                  Pending
                </span>
                <button
                  onClick={handleRelinkPayment}
                  disabled={linking}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {linking ? 'Opening Stripe…' : 'Complete Payment Setup'}
                </button>
              </div>
              {disabledExplainer && (
                <p className="text-xs text-gray-600 leading-snug">
                  {disabledExplainer}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
