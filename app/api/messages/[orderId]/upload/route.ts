/**
 * @file route.ts
 * @description POST endpoint for swipers to upload a delivery photo (JPEG/WebP, max 1MB).
 *   Saves to Supabase Storage delivery-photos bucket and inserts a delivery_photo message row.
 *   Called by: chat delivery photo send button
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'

const uuidSchema = z.string().uuid()
const ALLOWED_TYPES = ['image/jpeg', 'image/webp'] as const
const MAX_SIZE_BYTES = 1024 * 1024

/**
 * Uploads a delivery photo for the swiper and creates a delivery_photo message in the conversation.
 * @param params - Route params containing the order UUID
 * @returns 201 with the new message row; 400/401/403/500 on validation, auth, or upload failures
 * @called-by chat delivery photo send button
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
    return apiError('Only JPEG and WebP images are allowed', 400)
  }

  if (file.size > MAX_SIZE_BYTES) {
    return apiError('File must be 1 MB or smaller', 400)
  }

  // Verify conversation exists and user is the swiper
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, swiper_id')
    .eq('order_id', orderId)
    .single()

  if (!conversation) {
    return apiError('Conversation not found', 404)
  }

  if (conversation.swiper_id !== user.id) {
    return apiError('Only the swiper can upload delivery photos', 403)
  }

  const ext = file.type === 'image/jpeg' ? 'jpg' : 'webp'
  const uuid = crypto.randomUUID()
  const path = `${orderId}/${uuid}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('delivery-photos')
    .upload(path, await file.arrayBuffer(), { contentType: file.type })

  if (uploadError) {
    return apiError('Failed to upload photo', 500)
  }

  const { data: { publicUrl } } = supabase.storage
    .from('delivery-photos')
    .getPublicUrl(path)

  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      body: null,
      message_type: 'delivery_photo',
      image_url: publicUrl,
    })
    .select()
    .single()

  if (msgError) {
    return apiError('Failed to save message', 500)
  }

  return apiSuccess(message, 201)
}
