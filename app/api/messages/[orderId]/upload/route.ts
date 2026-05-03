/**
 * @file route.ts
 * @description POST endpoint for swipers to upload a completion photo
 *   (JPEG/PNG/WebP/HEIC/HEIF, max 1MB). Saves to the Supabase Storage `completion-photos`
 *   bucket and inserts a `completion_photo` message into the order conversation.
 *   Called by: chat completion-photo send button
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'
import { signCompletionPhotoPath } from '@/lib/storage/sign-screenshots'

const uuidSchema = z.string().uuid()
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const
const MAX_SIZE_BYTES = 1024 * 1024

/**
 * Uploads a completion photo for the swiper and creates a completion_photo message in the conversation.
 * @param params - Route params containing the order UUID
 * @returns 201 with the new message row; 400/401/403/500 on validation, auth, or upload failures
 * @called-by chat completion-photo send button
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  if (!uuidSchema.safeParse(orderId).success) {
    return apiError('Invalid order ID', 400)
  }

  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) return apiError('Unauthorized', 401)

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof Blob)) {
    return apiError('file is required', 400)
  }

  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return apiError('Only JPEG, PNG, WebP, HEIC, and HEIF images are allowed', 400)
  }

  if (file.size > MAX_SIZE_BYTES) {
    return apiError('File must be 1 MB or smaller', 400)
  }

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, swiper_id')
    .eq('order_id', orderId)
    .single()

  if (!conversation) {
    return apiError('Conversation not found', 404)
  }

  if (conversation.swiper_id !== user.id) {
    return apiError('Only the swiper can upload completion photos', 403)
  }

  const EXT_MAP: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  }
  const ext = EXT_MAP[file.type] ?? 'jpg'
  const uuid = crypto.randomUUID()
  const path = `${orderId}/${uuid}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('completion-photos')
    .upload(path, await file.arrayBuffer(), { contentType: file.type })

  if (uploadError) {
    return apiError('Failed to upload photo', 500)
  }

  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      body: null,
      message_type: 'completion_photo',
      image_url: path,
    })
    .select()
    .single()

  if (msgError) {
    return apiError('Failed to save message', 500)
  }

  const signedUrl = await signCompletionPhotoPath(message.image_url)
  return apiSuccess({ ...message, image_url: signedUrl ?? message.image_url }, 201)
}
