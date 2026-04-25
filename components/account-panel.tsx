'use client'

/**
 * @file account-panel.tsx
 * @description Account modal — second consumer of the S03 <Modal> primitive
 *   after /swiper/orders. router.back() preserved on close so deep-link
 *   semantics from any route survive (header avatar tap, swiper-button
 *   redirect, OAuth landing). Hosts AccountActions + SwiperSection inside
 *   <ModalContent>. The catalog testids `account-page` (root) and
 *   `account-modal` (modal content) both ride along.
 *   Called by: app/account/page.tsx
 * @dependencies components/ui/modal, app/account/account-actions, app/account/swiper-section
 */

import { useRouter } from 'next/navigation'
import { AccountActions } from '@/app/account/account-actions'
import { SwiperSection } from '@/app/account/swiper-section'
import { Modal, ModalContent, ModalTitle } from '@/components/ui/modal'

interface School {
  id: string
  name: string
}

interface AccountPanelProps {
  email: string
  profile: { is_swiper: boolean; school_id: string | null }
  stripeAccount: { onboarding_complete: boolean } | null
  schools: School[]
}

/**
 * Renders the /account modal: email, account actions, swiper section.
 * @param email - The authenticated user's email
 * @param profile - Profile flags driving the swiper-section branch
 * @param stripeAccount - Stripe Connect onboarding state, or null
 * @param schools - Schools available for the swiper school selector
 * @returns Modal-wrapped account panel; closes via router.back()
 * @called-by app/account/page.tsx
 */
export function AccountPanel({ email, profile, stripeAccount, schools }: AccountPanelProps) {
  const router = useRouter()

  return (
    <main data-testid="account-page" className="sr-only">
      <Modal
        open
        onOpenChange={(open) => {
          if (!open) router.back()
        }}
      >
        <ModalContent
          data-testid="account-modal"
          className="max-w-sm gap-5"
        >
          <ModalTitle className="text-xl">Account</ModalTitle>
          <p
            data-testid="account-email-display"
            className="text-sm text-muted-foreground"
          >
            {email}
          </p>
          <AccountActions />
          <SwiperSection
            profile={profile}
            stripeAccount={stripeAccount}
            schools={schools}
          />
        </ModalContent>
      </Modal>
    </main>
  )
}
