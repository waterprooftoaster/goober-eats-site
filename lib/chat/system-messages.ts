/**
 * @file system-messages.ts
 * @description Inserts system messages into an order's conversation via the service client.
 *   Called by: app/api/orders/[id]/accept/route.ts, app/api/orders/[id]/status/route.ts
 * @dependencies lib/supabase/service.ts
 */

import { createServiceClient } from '@/lib/supabase/service'

/**
 * Inserts a system message into the conversation for the given order.
 * @param orderId - The order whose conversation receives the message
 * @param text - Message body; displayed as a neutral system notification in the chat thread
 * @called-by app/api/orders/[id]/accept/route.ts, app/api/orders/[id]/status/route.ts
 */
export async function sendSystemMessage(orderId: string, text: string): Promise<void> {
  const service = createServiceClient()

  const { data: conversation } = await service
    .from('conversations')
    .select('id')
    .eq('order_id', orderId)
    .single()

  if (!conversation) return

  await service.from('messages').insert({
    conversation_id: conversation.id,
    sender_id: null,
    body: text,
    message_type: 'system',
  })
}

