'use client'

/**
 * @file swiper-registration-form.tsx
 * @description Client form for completing swiper registration: school selection then Stripe Connect onboarding.
 *   Called by: app/swiper-registration/page.tsx
 */

import { useState } from 'react'

type School = { id: string; name: string }

type Props = {
  schoolId: string | null
  schoolName: string | null
  schools: School[]
}

/**
 * Renders a two-step swiper registration form: school selection then Stripe Connect setup.
 * @param schoolId - Pre-selected school ID from the user's profile (if any)
 * @param schoolName - Display name for the pre-selected school
 * @param schools - Full list of available schools for the selector
 * @returns School selector and Stripe onboarding button
 * @called-by app/swiper-registration/page.tsx
 */
export function SwiperRegistrationForm({ schoolId, schoolName, schools }: Props) {
  const [selectedSchoolId, setSelectedSchoolId] = useState(schoolId ?? '')
  const [schoolConfirmed, setSchoolConfirmed] = useState(schoolId !== null)
  const [confirmedName, setConfirmedName] = useState(schoolName)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSaveSchool() {
    if (!selectedSchoolId) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: selectedSchoolId }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Failed to save school')
      return
    }
    const name = schools.find((s) => s.id === selectedSchoolId)?.name ?? null
    setConfirmedName(name)
    setSchoolConfirmed(true)
  }

  async function handleContinue() {
    setConnecting(true)
    setError(null)
    const res = await fetch('/api/stripe/connect', { method: 'POST' })
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Failed to set up payment account')
      setConnecting(false)
      return
    }
    const { url } = await res.json()
    window.location.href = url
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">Become a Swiper</h1>
      <p className="text-gray-600 mb-8">
        Fulfill orders using your meal plan and earn money per delivery.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* School section */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">Your school</p>
        {schoolConfirmed ? (
          <p className="text-sm font-medium">{confirmedName}</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
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
              disabled={saving || !selectedSchoolId}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save School'}
            </button>
          </div>
        )}
      </div>

      {/* Continue to Stripe */}
      <button
        onClick={handleContinue}
        disabled={!schoolConfirmed || connecting}
        className="w-full rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {connecting ? 'Opening Stripe…' : 'Continue to Payment Setup'}
      </button>
    </>
  )
}
