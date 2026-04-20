'use client'

/**
 * @file chat-thread.tsx
 * @description Scrollable thread rendering pinned pseudo-messages and real chat messages.
 *   Called by: components/chat/chat-view.tsx
 * @dependencies lib/types/messaging.ts
 */

import type { RefObject } from 'react'
import Image from 'next/image'
import type { Message } from '@/lib/types/messaging'
import { cn } from '@/lib/utils'

interface Props {
  pseudoMessages: string[]
  messages: Message[]
  currentUserId: string | null
  messagesEndRef: RefObject<HTMLDivElement | null>
}

/**
 * Renders pinned status pseudo-messages followed by real messages, aligned by sender.
 * @param pseudoMessages - Status text strings prepended above real messages (not stored in DB)
 * @param messages - Real chat and delivery photo messages from Supabase
 * @param currentUserId - The authenticated user's ID for aligning own messages to the right
 * @param messagesEndRef - Ref to the scroll anchor div at the bottom of the thread
 * @called-by components/chat/chat-view.tsx
 */
export function ChatThread({ pseudoMessages, messages, currentUserId, messagesEndRef }: Props) {
  return (
    <div className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
      {pseudoMessages.map((text, i) => (
        <div key={`pseudo-${i}`} className="mb-1 mr-auto flex max-w-[75%] flex-col items-start">
          <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-900">
            {text}
          </div>
        </div>
      ))}
      {messages.map((message) => {
        const isPhoto = message.message_type === 'delivery_photo'
        const isOwn = message.sender_id === currentUserId

        return (
          <div
            key={message.id}
            className={cn(
              'mb-1 flex max-w-[75%] flex-col',
              isOwn ? 'ml-auto items-end' : 'mr-auto items-start'
            )}
          >
            {isPhoto && message.image_url ? (
              <a
                href={message.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Image
                  src={message.image_url}
                  alt="Delivery photo"
                  width={200}
                  height={200}
                  className="cursor-pointer rounded-lg border border-gray-100 object-cover transition-opacity hover:opacity-90"
                />
              </a>
            ) : (
              <div
                className={cn(
                  'rounded-2xl px-3 py-2 text-sm',
                  isOwn
                    ? 'rounded-br-sm bg-black text-white'
                    : 'rounded-bl-sm bg-gray-100 text-gray-900'
                )}
              >
                {message.body}
              </div>
            )}
          </div>
        )
      })}
      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  )
}
