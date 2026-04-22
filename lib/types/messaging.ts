/**
 * @file messaging.ts
 * @description TypeScript interfaces for conversations and messages.
 *   Called by: components/chat/, hooks/use-messages.ts, app/api/messages/
 */

export interface Conversation {
  id: string
  order_id: string
  orderer_id: string | null
  swiper_id: string
  swiper_full_name: string | null
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  body: string | null
  message_type: 'system' | 'text' | 'completion_photo'
  expires_at: string
  image_url: string | null
  sent_at: string
}
