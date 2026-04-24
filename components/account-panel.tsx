'use client'

/**
 * @file account-panel.tsx
 * @description Modal overlay panel showing the user's email, account actions, and swiper section.
 *   Called by: app/account/page.tsx, app/@modal/(.)account/page.tsx
 * @dependencies app/account/account-actions.tsx, app/account/swiper-section.tsx
 */

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { AccountActions } from '@/app/account/account-actions'
import { SwiperSection } from '@/app/account/swiper-section'

type School = { id: string; name: string }

interface AccountPanelProps {
  email: string
  profile: { is_swiper: boolean; school_id: string | null }
  stripeAccount: { onboarding_complete: boolean } | null
  schools: School[]
}

/**
 * Renders the full account modal with email display, action buttons, and swiper management.
 * @param email - Authenticated user's email address
 * @param profile - User profile with is_swiper and school_id fields
 * @param stripeAccount - Stripe Connect onboarding status, or null if not connected
 * @param schools - Available schools for the swiper school selector
 * @called-by app/account/page.tsx, app/@modal/(.)account/page.tsx
 */
export function AccountPanel({ email, profile, stripeAccount, schools }: AccountPanelProps) {
  const router = useRouter()

  return (
    <div data-testid="account-page" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close account"
        onClick={() => router.back()}
        className="absolute inset-0 cursor-default"
      />

      {/* Card */}
      <div data-testid="account-modal" className="relative z-10 w-full mx-4 max-w-sm bg-white rounded-xl shadow-xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
          <h1 className="text-base font-semibold text-gray-900">Account</h1>
          <button
            type="button"
            aria-label="Close"
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X className="h-4 w-4 text-gray-700" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p data-testid="account-email-display" className="text-sm text-gray-500 mb-6">{email}</p>
          <AccountActions />
          <SwiperSection
            profile={profile}
            stripeAccount={stripeAccount}
            schools={schools}
          />
        </div>
      </div>
    </div>
  )
}
