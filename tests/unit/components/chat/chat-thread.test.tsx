import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { ChatThread } from '@/components/chat/chat-thread'
import type { Conversation, Message } from '@/lib/types/messaging'

const CONVERSATION: Conversation = {
  id: 'conv-111',
  order_id: 'order-aaa',
  orderer_id: 'user-orderer',
  swiper_id: 'user-swiper',
  created_at: '2026-03-23T10:00:00Z',
}

const CURRENT_USER_ID = 'user-orderer'

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversation_id: CONVERSATION.id,
    sender_id: CURRENT_USER_ID,
    body: 'hello',
    message_type: 'text',
    expires_at: '2026-03-25T10:00:00Z',
    image_url: null,
    sent_at: '2026-03-23T10:01:00Z',
    ...overrides,
  }
}

function renderThread(messages: Message[]) {
  const messagesEndRef = createRef<HTMLDivElement>()
  return render(
    <ChatThread
      messages={messages}
      conversation={CONVERSATION}
      currentUserId={CURRENT_USER_ID}
      messagesEndRef={messagesEndRef}
    />
  )
}

describe('ChatThread', () => {
  it('renders without crashing when messages is empty', () => {
    const { container } = renderThread([])
    expect(container).toBeInTheDocument()
  })

  it('renders a system message centered and italic without sender label', () => {
    renderThread([
      makeMessage({ sender_id: null, message_type: 'system', body: 'Order accepted' }),
    ])
    expect(screen.getByText('Order accepted')).toBeInTheDocument()
    // System messages should not have "You", "Swiper", or "Orderer" labels
    expect(screen.queryByText('You')).not.toBeInTheDocument()
    expect(screen.queryByText('Swiper')).not.toBeInTheDocument()
  })

  it('shows "You" label for own text messages', () => {
    renderThread([makeMessage({ sender_id: CURRENT_USER_ID, message_type: 'text', body: 'hi' })])
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('hi')).toBeInTheDocument()
  })

  it('shows "Swiper" label for swiper text messages', () => {
    renderThread([
      makeMessage({ sender_id: 'user-swiper', message_type: 'text', body: 'on my way' }),
    ])
    expect(screen.getByText('Swiper')).toBeInTheDocument()
    expect(screen.getByText('on my way')).toBeInTheDocument()
  })

  it('shows "Orderer" label for orderer messages when current user is swiper', () => {
    const swipersRef = createRef<HTMLDivElement>()
    render(
      <ChatThread
        messages={[makeMessage({ sender_id: 'user-orderer', message_type: 'text', body: 'ready?' })]}
        conversation={CONVERSATION}
        currentUserId="user-swiper"
        messagesEndRef={swipersRef}
      />
    )
    expect(screen.getByText('Orderer')).toBeInTheDocument()
  })

  it('shows a date separator for each distinct date group', () => {
    const messages = [
      makeMessage({ id: 'a', sent_at: '2026-03-22T10:00:00Z', body: 'day 1' }),
      makeMessage({ id: 'b', sent_at: '2026-03-23T10:00:00Z', body: 'day 2' }),
    ]
    renderThread(messages)
    // Two messages on two different dates → two separators
    // "Yesterday" and "Today" (or date labels depending on test run date — use text fragments)
    expect(screen.getByText('day 1')).toBeInTheDocument()
    expect(screen.getByText('day 2')).toBeInTheDocument()
    // There should be two date separator elements
    const separators = document.querySelectorAll('[data-testid="date-separator"]')
    expect(separators).toHaveLength(2)
  })

  it('shows a single separator for messages on the same date', () => {
    const messages = [
      makeMessage({ id: 'a', sent_at: '2026-03-23T10:00:00Z', body: 'msg 1' }),
      makeMessage({ id: 'b', sent_at: '2026-03-23T11:00:00Z', body: 'msg 2' }),
    ]
    renderThread(messages)
    const separators = document.querySelectorAll('[data-testid="date-separator"]')
    expect(separators).toHaveLength(1)
  })

  it('renders delivery photo as img inside a link', () => {
    renderThread([
      makeMessage({
        id: 'p',
        sender_id: 'user-swiper',
        message_type: 'delivery_photo',
        body: null,
        image_url: 'https://example.com/photo.jpg',
      }),
    ])
    const img = screen.getByRole('img', { name: /delivery photo/i })
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
    const link = img.closest('a')
    expect(link).toHaveAttribute('href', 'https://example.com/photo.jpg')
    expect(link).toHaveAttribute('target', '_blank')
  })

})
