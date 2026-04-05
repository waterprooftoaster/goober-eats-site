'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useChatPanel } from '@/components/chat-panel'
import type { OrderStatus } from '@/lib/types/database'

interface Props {
  orderId: string
  initialStatus: OrderStatus
}

export function GuestOrderPanelOpener({ orderId, initialStatus }: Props) {
  const { openPanel } = useChatPanel()
  const router = useRouter()

  useEffect(() => {
    openPanel(orderId, initialStatus, true)
    router.replace('/')
  }, [orderId, initialStatus, openPanel, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
    </div>
  )
}
