/**
 * @file route.ts
 * @description POST endpoint for guests to send messages in their order's conversation.
 *   Called by: components/chat/ (guest chat panel)
 * @dependencies lib/supabase/service.ts, lib/api/guest-auth.ts, lib/api/helpers.ts
 */

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendMessageSchema } from '@/lib/types/api'
import { validateGuestOrder } from '@/lib/api/guest-auth'
import { apiError, apiSuccess } from '@/lib/api/helpers'

/**
 * Sends a message in the conversation for the guest's order.
 * @returns 201 with the new message row; 400/401/403 on validation or auth failure
 * @called-by components/chat/ (guest chat panel)
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = sendMessageSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400)
  }
  const { order_id, body: messageBody, message_type } = parsed.data

  const auth = await validateGuestOrder(order_id)
  if (auth.error) return auth.error

  const supabase = createServiceClient()

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('order_id', order_id)
    .maybeSingle()

  if (!conversation) {
    return apiError('Conversation not found', 404)
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      sender_id: null, // guest messages have no auth profile
      body: messageBody,
      message_type,
    })
    .select()
    .single()

  if (error) {
    return apiError('Failed to send message', 500)
  }

  return apiSuccess(message, 201)
}
