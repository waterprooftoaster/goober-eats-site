'use client'

import type { RefObject } from 'react'
import type { Message } from '@/lib/types/messaging'
import { cn } from '@/lib/utils'

interface Props {
  pseudoMessages: string[]
  messages: Message[]
  currentUserId: string | null
  messagesEndRef: RefObject<HTMLDivElement | null>
}

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
                <img
                  src={message.image_url}
                  alt="Delivery photo"
                  className="max-w-[200px] cursor-pointer rounded-lg border border-gray-100 object-cover transition-opacity hover:opacity-90"
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
