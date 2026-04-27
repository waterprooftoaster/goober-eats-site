/**
 * @file chat-thread.test.tsx
 * @description Unit tests for the ChatThread component (message list with scroll-to-bottom).
 *   Called by: Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { ChatThread } from '@/components/chat/chat-thread'
import type { PseudoMessage } from '@/components/chat/chat-view'
import type { Message } from '@/lib/types/messaging'
import type { OptimisticMessage } from '@/hooks/use-messages'

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
    temp_id: null,
    ...overrides,
  }
}

function renderThread(messages: Message[], pseudoTexts: string[] = []) {
  const pseudoMessages: PseudoMessage[] = pseudoTexts.map((text) => ({ text }))
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

  it('renders completion photo as img inside a link', () => {
    renderThread([
      makeMessage({
        id: 'p',
        sender_id: 'user-swiper',
        message_type: 'completion_photo',
        body: null,
        image_url: 'https://example.com/photo.jpg',
      }),
    ])
    const img = screen.getByRole('img', { name: /completion photo/i })
    // next/image rewrites src to /_next/image?url=<encoded>; decode to verify the right URL is used
    expect(decodeURIComponent(img.getAttribute('src') ?? '')).toContain('https://example.com/photo.jpg')
    const link = img.closest('a')
    expect(link).toHaveAttribute('href', 'https://example.com/photo.jpg')
    expect(link).toHaveAttribute('target', '_blank')
  })

  // --- Optimistic UI treatments (S07 C2) ---

  it('renders the pending treatment ("Sending…") for an optimistic entry', () => {
    const pending: OptimisticMessage = {
      ...makeMessage({ id: '__optimistic_x', body: 'just typed', temp_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }),
      status: 'pending',
    }
    const messagesEndRef = createRef<HTMLDivElement>()
    render(
      <ChatThread
        pseudoMessages={[]}
        messages={[pending]}
        currentUserId={CURRENT_USER_ID}
        messagesEndRef={messagesEndRef}
      />
    )
    expect(screen.getByTestId('chat-message-pending')).toBeInTheDocument()
    expect(screen.getByText('Sending…')).toBeInTheDocument()
  })

  it('renders the failed treatment with a Retry button that fires onRetry(temp_id, body)', () => {
    const TEMP = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeef'
    const failed: OptimisticMessage = {
      ...makeMessage({ id: '__optimistic_y', body: 'failed body', temp_id: TEMP }),
      status: 'failed',
    }
    const onRetry = vi.fn()
    const messagesEndRef = createRef<HTMLDivElement>()
    render(
      <ChatThread
        pseudoMessages={[]}
        messages={[failed]}
        currentUserId={CURRENT_USER_ID}
        messagesEndRef={messagesEndRef}
        onRetry={onRetry}
      />
    )

    expect(screen.getByTestId('chat-message-failed')).toBeInTheDocument()
    expect(screen.getByText(/failed to send/i)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('chat-message-retry'))

    expect(onRetry).toHaveBeenCalledWith(TEMP, 'failed body')
  })
})
