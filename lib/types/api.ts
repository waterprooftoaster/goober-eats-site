import { z } from 'zod'

// Only statuses a client can supply via the status endpoint:
// 'in_progress' is set by the accept endpoint; 'open' is used for swiper un-accept.
export const updateOrderStatusSchema = z.object({
  status: z.enum(['completed', 'cancelled', 'open']),
})

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>

export const sendMessageSchema = z.object({
  order_id: z.string().uuid(),
  body: z.string().min(1).max(1000),
  // delivery_photo messages are created via a separate upload endpoint (session 3)
  message_type: z.enum(['text', 'system']).default('text'),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>

export const addCartItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  selected_options: z.array(z.string().uuid()).max(50).default([]),
})

export type AddCartItemInput = z.infer<typeof addCartItemSchema>

export const updateProfileSchema = z
  .object({
    school_id: z.string().uuid().optional(),
    is_swiper: z.boolean().optional(),
  })
  .refine((d) => d.school_id !== undefined || d.is_swiper !== undefined, {
    message: 'At least one field must be provided',
  })

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
