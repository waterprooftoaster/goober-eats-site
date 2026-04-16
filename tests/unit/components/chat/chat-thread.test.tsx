import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { ChatThread } from '@/components/chat/chat-thread'
import type { Message } from '@/lib/types/messaging'

const CONV_ID = 'conv-111'
const CURRENT_USER_ID = 'user-orderer'

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversation_id: CONV_ID,
    sender_id: CURRENT_USER_ID,
    body: 'hello',
    message_type: 'text',
    expires_at: '2026-03-25T10:00:00Z',
    image_url: null,
    sent_at: '2026-03-23T10:01:00Z',
    ...overrides,
  }
}

function renderThread(messages: Message[], pseudoMessages: string[] = []) {
  const messagesEndRef = createRef<HTMLDivElement>()
  return render(
    <ChatThread
      pseudoMessages={pseudoMessages}
      messages={messages}
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

  it('renders pseudo-messages before real messages', () => {
    renderThread(
      [makeMessage({ body: 'real message' })],
      ['Status update one', 'Status update two']
    )
    expect(screen.getByText('Status update one')).toBeInTheDocument()
    expect(screen.getByText('Status update two')).toBeInTheDocument()
    expect(screen.getByText('real message')).toBeInTheDocument()
  })

  it('renders real messages with no sender labels', () => {
    renderThread([makeMessage({ sender_id: CURRENT_USER_ID, body: 'hi' })])
    expect(screen.getByText('hi')).toBeInTheDocument()
    expect(screen.queryByText('You')).not.toBeInTheDocument()
    expect(screen.queryByText('Swiper')).not.toBeInTheDocument()
    expect(screen.queryByText('Orderer')).not.toBeInTheDocument()
  })

  it('renders multiple messages as a flat list with no date separators', () => {
    const messages = [
      makeMessage({ id: 'a', sent_at: '2026-03-22T10:00:00Z', body: 'day 1' }),
      makeMessage({ id: 'b', sent_at: '2026-03-23T10:00:00Z', body: 'day 2' }),
    ]
    renderThread(messages)
    expect(screen.getByText('day 1')).toBeInTheDocument()
    expect(screen.getByText('day 2')).toBeInTheDocument()
    const separators = document.querySelectorAll('[data-testid="date-separator"]')
    expect(separators).toHaveLength(0)
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
