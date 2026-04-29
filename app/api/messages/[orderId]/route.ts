/**
 * @file route.ts
 * @description GET endpoint to load a conversation and its messages for an authenticated order participant.
 *   Called by: app/order/[orderId]/page.tsx (authenticated view)
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { signCompletionPhotoPathsBatch } from '@/lib/storage/sign-screenshots'

const uuidSchema = z.string().uuid()

/**
 * Returns the conversation and messages for an authenticated order participant.
 * @param params - Route params containing the order UUID
 * @returns JSON { conversation, messages }; 401/404 on auth or not-found
 * @called-by app/order/[orderId]/page.tsx (authenticated view)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  if (!uuidSchema.safeParse(orderId).success) {
    return apiError('Invalid order ID', 400)
  }

  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) return apiError('Unauthorized', 401)

  // RLS filters to conversations where user is a participant
  const { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('order_id', orderId)
    .single()

  if (!conversation) {
    return apiError('Conversation not found', 404)
  }

  const [{ data: messages }, { data: swiperProfile }] = await Promise.all([
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('sent_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', conversation.swiper_id)
      .maybeSingle(),
  ])

  const enriched = { ...conversation, swiper_full_name: swiperProfile?.full_name ?? null }

  // Single batched signing call for every completion-photo path in the
  // conversation; replaces the prior N+1 Promise.all(map) pattern.
  const completionPaths = (messages ?? [])
    .filter((m) => m.message_type === 'completion_photo' && m.image_url)
    .map((m) => m.image_url as string)
  const urlByPath = await signCompletionPhotoPathsBatch(completionPaths)
  const signedMessages = (messages ?? []).map((m) => {
    if (m.message_type !== 'completion_photo' || !m.image_url) return m
    return { ...m, image_url: urlByPath.get(m.image_url) ?? m.image_url }
  })
  return apiSuccess({ conversation: enriched, messages: signedMessages })
}
