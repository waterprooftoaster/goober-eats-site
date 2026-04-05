'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AccountActions } from '@/app/account/account-actions'
import { SwiperSection } from '@/app/account/swiper-section'

type School = { id: string; name: string }

interface AccountPanelProps {
  email: string
  profile: { is_swiper: boolean; school_id: string | null }
  stripeAccount: { onboarding_complete: boolean } | null
  schools: School[]
}

export function AccountPanel({ email, profile, stripeAccount, schools }: AccountPanelProps) {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    el.style.transform = 'translateX(-100%)'
    requestAnimationFrame(() => {
      el.style.transition = 'transform 300ms ease-out'
      el.style.transform = 'translateX(0)'
    })
  }, [])

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close account"
        onClick={() => router.back()}
        className="fixed inset-0 z-40 w-full bg-black/40 cursor-default"
      />

      {/* Sliding panel — fixed to left edge */}
      <div
        ref={panelRef}
        className="fixed left-0 top-0 z-50 flex h-screen w-full md:max-w-sm flex-col bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4">
          <button
            type="button"
            aria-label="Back"
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 text-gray-700" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">Account</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-sm text-gray-500 mb-6">{email}</p>
          <AccountActions />
          <SwiperSection
            profile={profile}
            stripeAccount={stripeAccount}
            schools={schools}
          />
        </div>
      </div>
    </>
  )
}
