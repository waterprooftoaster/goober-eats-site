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
import type { OrderStatus } from '@/lib/types/database'

interface Props {
  orderId: string
  initialStatus: OrderStatus
  eateryName: string
}

/**
 * Signs in anonymously, associates the anon session with the order, opens the chat panel, then redirects.
 * @param orderId - UUID of the guest's order
 * @param initialStatus - Current order status passed into the chat panel
 * @param eateryName - Eatery name displayed in the chat panel header
 * @returns Spinner while bootstrapping; redirects to / when done
 * @called-by app/order/[orderId]/page.tsx
 */
export function GuestPanelOpener({ orderId, initialStatus, eateryName }: Props) {
  const { openPanel } = useChatPanel()
  const router = useRouter()

  useEffect(() => {
    async function initAndOpen() {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInAnonymously()
      if (!error && data.session) {
        await fetch(`/api/guest/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anon_user_id: data.session.user.id }),
        })
      }
      openPanel(orderId, initialStatus, eateryName)
      router.replace('/')
    }

    initAndOpen()
  }, [orderId, initialStatus, eateryName, openPanel, router])

  return (
    <div data-testid="guest-panel-opener" className="flex min-h-screen items-center justify-center">
      <div data-testid="guest-bootstrap-spinner" className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
    </div>
  )
}
