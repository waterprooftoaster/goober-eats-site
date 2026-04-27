/**
 * @file route.ts
 * @description POST endpoint for authenticated users to send text or system messages in their order's conversation.
 *   Called by: components/chat/chat-input.tsx
 * @dependencies lib/supabase/server.ts, lib/types/api.ts, lib/api/helpers.ts
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMessageSchema } from '@/lib/types/api'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
/**
 * Sends a text or system message in the authenticated user's order conversation.
 * @returns 201 with the new message row; 401/404/500 on auth or DB failure
 * @called-by components/chat/chat-input.tsx
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) return apiError('Unauthorized', 401)

  const body = await request.json()
  const parsed = sendMessageSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400)
  }
  const { order_id, body: messageBody, message_type, temp_id } = parsed.data

  // Look up conversation by order_id (RLS filters to participant)
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('order_id', order_id)
    .single()

  if (!conversation) {
    return apiError('Conversation not found', 404)
  }

  // Insert message (RLS verifies participant + sender). temp_id is echoed
  // through the insert + select so the realtime INSERT payload carries it
  // back to the originating client for optimistic-UI dedupe.
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      body: messageBody,
      message_type,
      temp_id: temp_id ?? null,
    })
    .select()
    .single()

  if (error) {
    return apiError('Failed to send message', 500)
  }

  return apiSuccess(message, 201)
}
