import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import { ChatView } from '@/components/chat/chat-view'

const uuidSchema = z.string().uuid()

export default async function OrderChatPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: orderId } = await params

  if (!uuidSchema.safeParse(orderId).success) {
    redirect('/')
  }

  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) redirect('/auth/login')

  // Fetch order and conversation in parallel
  // RLS on orders ensures only orderer or swiper can see the row
  const [orderResult, conversationResult] = await Promise.all([
    supabase.from('orders').select('id, status').eq('id', orderId).single(),
    supabase.from('conversations').select('id').eq('order_id', orderId).single(),
  ])

  // Not a participant or order doesn't exist
  if (!orderResult.data) {
    redirect('/')
  }

  const { status } = orderResult.data

  // Order not yet accepted — no conversation exists yet
  if (status === 'open') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900">Looking for a swiper…</p>
          <p className="mt-2 text-sm text-gray-500">
            You&apos;ll be able to chat once a swiper accepts your order.
          </p>
        </div>
      </main>
    )
  }

  // No conversation yet for a non-pending order (shouldn't happen, but guard)
  if (!conversationResult.data) {
    redirect('/')
  }

  return (
    <main className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <ChatView
          orderId={orderId}
          currentUserId={user.id}
          orderStatus={status}
        />
      </div>
    </main>
  )
}
