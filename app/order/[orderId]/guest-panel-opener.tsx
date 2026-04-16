'use client'

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
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
    </div>
  )
}
