'use client'

/**
 * @file guest-panel-opener.tsx
 * @description Client component that bootstraps an anonymous Supabase session for a guest orderer,
 *   links the anon user to the order, opens the chat panel, then redirects to home.
 *   Called by: app/order/[orderId]/page.tsx
 * @dependencies components/chat-panel.tsx, lib/supabase/client.ts
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useChatPanel } from '@/components/chat-panel'
import { createClient } from '@/lib/supabase/client'
import { PENDING_SCHOOL_ID_KEY } from '@/lib/constants'
import type { OrderStatus } from '@/lib/types/database'

interface Props {
  orderId: string
  initialStatus: OrderStatus
  eateryName: string
  schoolId: string
}

/**
 * Signs in anonymously, associates the anon session with the order, opens the chat panel, then redirects.
 * @param orderId - UUID of the guest's order
 * @param initialStatus - Current order status passed into the chat panel
 * @param eateryName - Eatery name displayed in the chat panel header
 * @param schoolId - Order's school_id; re-seeded into sessionStorage so HomeUpload's guard accepts the anon visitor
 * @returns Spinner while bootstrapping; redirects to /order/new when done
 * @called-by app/order/[orderId]/page.tsx
 */
export function GuestPanelOpener({ orderId, initialStatus, eateryName, schoolId }: Props) {
  const { openPanel } = useChatPanel()
  const router = useRouter()

  useEffect(() => {
    async function initAndOpen() {
      const supabase = createClient()
      // Reuse an existing anon session if one is already present — minting a
      // fresh anon user on every order would orphan prior guest orders (their
      // anon_user_id would point at the discarded identity), preventing the
      // chat-panel stack from re-surfacing them.
      const { data: existing } = await supabase.auth.getSession()
      let anonUserId = existing.session?.user.id ?? null
      if (!anonUserId) {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (!error && data.session) anonUserId = data.session.user.id
      }
      if (anonUserId) {
        await fetch(`/api/guest/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anon_user_id: anonUserId }),
        })
      }
      // Checkout cleared PENDING_SCHOOL_ID_KEY; re-seed it from the order so
      // HomeUpload's school-resolution guard doesn't bounce the anon visitor.
      sessionStorage.setItem(PENDING_SCHOOL_ID_KEY, schoolId)
      openPanel(orderId, initialStatus, eateryName)
      router.replace('/order/new')
    }

    initAndOpen()
  }, [orderId, initialStatus, eateryName, schoolId, openPanel, router])

  return (
    <main
      data-testid="guest-panel-opener"
      className="flex min-h-screen items-center justify-center"
    >
      <div
        data-testid="guest-bootstrap-spinner"
        role="status"
        aria-label="Opening your order…"
        className="size-6 animate-spin rounded-full border-2 border-border border-t-foreground"
      />
    </main>
  )
}
