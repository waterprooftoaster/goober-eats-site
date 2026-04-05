'use client'

import type { RefObject } from 'react'
import type { Conversation, Message } from '@/lib/types/messaging'
import { cn } from '@/lib/utils'

interface Props {
  messages: Message[]
  conversation: Conversation
  currentUserId: string | null
  messagesEndRef: RefObject<HTMLDivElement | null>
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function getSenderLabel(
  message: Message,
  conversation: Conversation,
  currentUserId: string | null
): string | null {
  if (message.sender_id === null) return null
  if (message.sender_id === currentUserId) return 'You'
  if (message.sender_id === conversation.swiper_id) return 'Swiper'
  if (message.sender_id === conversation.orderer_id) return 'Orderer'
  return null
}

interface MessageGroup {
  label: string
  messages: Message[]
}

function groupByDate(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  let currentLabel: string | null = null
  for (const message of messages) {
    const label = formatDateLabel(message.sent_at)
    if (label !== currentLabel) {
      groups.push({ label, messages: [message] })
      currentLabel = label
    } else {
      groups[groups.length - 1].messages.push(message)
    }
  }
  return groups
}

export function ChatThread({ messages, conversation, currentUserId, messagesEndRef }: Props) {
  const groups = groupByDate(messages)
  return (
    <div className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
      {groups.map((group) => (
        <div key={group.label}>
          {/* Date separator */}
          <div data-testid="date-separator" className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-100" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
              {group.label}
            </span>
            <div className="h-px flex-1 bg-gray-100" />
          </div>

          {group.messages.map((message) => {
            const isSystem = message.message_type === 'system'
            const isPhoto = message.message_type === 'delivery_photo'
            const isOwn = message.sender_id === currentUserId
            const senderLabel = getSenderLabel(message, conversation, currentUserId)

            if (isSystem) {
              return (
                <div key={message.id} className="my-2 flex justify-center">
                  <p className="px-4 text-center text-xs italic text-gray-400">{message.body}</p>
                </div>
              )
            }

            return (
              <div
                key={message.id}
                className={cn(
                  'mb-1 flex max-w-[75%] flex-col',
                  isOwn ? 'ml-auto items-end' : 'mr-auto items-start'
                )}
              >
                {senderLabel && (
                  <span className="mb-0.5 px-1 text-[10px] text-gray-400">{senderLabel}</span>
                )}
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
        </div>
      ))}
      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  )
}
