/**
 * @file chat-view.test.tsx
 * @description Unit tests for ChatView status notification matrix (role × order state).
 *   Called by: Vitest test runner
 * @dependencies @/hooks/use-messages (mocked)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Conversation } from '@/lib/types/messaging'

vi.mock('@/hooks/use-messages', () => ({
  useMessages: vi.fn(),
}))

import { ChatView } from '@/components/chat/chat-view'
import { useMessages } from '@/hooks/use-messages'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORDER_ID = 'abcdef12-3456-4000-8000-000000000001'
const SHORT_ID = ORDER_ID.slice(0, 8) // 'abcdef12'
const EATERY_NAME = 'Carlyle Court'

const SWIPER_ID = 'user-swiper'
const ORDERER_ID = 'user-orderer'

const CONVERSATION: Conversation = {
  id: 'conv-1',
  order_id: ORDER_ID,
  orderer_id: ORDERER_ID,
  swiper_id: SWIPER_ID,
  swiper_full_name: 'Alex Smith',
  created_at: '2026-04-01T10:00:00Z',
}

const SEND_MESSAGE = vi.fn().mockResolvedValue(undefined)

function mockMessages(overrides: Partial<ReturnType<typeof useMessages>> = {}) {
  vi.mocked(useMessages).mockReturnValue({
    messages: [],
    conversation: null,
    isLoading: false,
    error: null,
    sendMessage: SEND_MESSAGE,
    ...overrides,
  })
}

function renderView(props: {
  currentUserId: string | null
  orderStatus: Parameters<typeof ChatView>[0]['orderStatus']
}) {
  return render(
    <ChatView
      orderId={ORDER_ID}
      eateryName={EATERY_NAME}
      currentUserId={props.currentUserId}
      orderStatus={props.orderStatus}
    />
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // jsdom does not implement scrollIntoView; mock it to avoid test errors
    Element.prototype.scrollIntoView = vi.fn()
  })

  // --- Loading / error states ---

  it('shows a spinner while loading', () => {
    mockMessages({ isLoading: true })
    const { container } = renderView({ currentUserId: ORDERER_ID, orderStatus: 'open' })
    // Spinner rendered — no status bubble
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
    expect(screen.queryByText(/successfully placed/i)).not.toBeInTheDocument()
  })

  it('shows an error message when loading fails', () => {
    mockMessages({ isLoading: false, error: 'Network error — please refresh' })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'open' })
    expect(screen.getByText('Network error — please refresh')).toBeInTheDocument()
  })

  // --- Status notification: orderer + open ---

  it('orderer sees placed-order pseudo-message in open state', () => {
    mockMessages({ conversation: null })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'open' })
    expect(
      screen.getByText(
        `You've successfully placed order #${SHORT_ID} at ${EATERY_NAME}! Hold tight while a swiper accepts your order.`
      )
    ).toBeInTheDocument()
  })

  it('guest (null userId) sees placed-order pseudo-message in open state', () => {
    mockMessages({ conversation: null })
    renderView({ currentUserId: null, orderStatus: 'open' })
    expect(screen.getByText(/successfully placed order/i)).toBeInTheDocument()
  })

  it('input is disabled when no conversation exists', () => {
    mockMessages({ conversation: null })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'open' })
    const input = screen.getByPlaceholderText('Conversation closed')
    expect(input).toBeDisabled()
  })

  // --- Status notification: orderer + in_progress ---

  it('orderer sees both placed-order and preparing messages stacked in in_progress', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'in_progress' })
    expect(screen.getByText(/successfully placed order/i)).toBeInTheDocument()
    expect(screen.getByText('Swiper Alex Smith is preparing your order!')).toBeInTheDocument()
  })

  it('orderer sees fallback name when swiper_full_name is null', () => {
    mockMessages({ conversation: { ...CONVERSATION, swiper_full_name: null } })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'in_progress' })
    expect(screen.getByText(/successfully placed order/i)).toBeInTheDocument()
    expect(screen.getByText('Swiper Your swiper is preparing your order!')).toBeInTheDocument()
  })

  it('guest orderer sees both messages stacked in in_progress state', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({ currentUserId: null, orderStatus: 'in_progress' })
    expect(screen.getByText(/successfully placed order/i)).toBeInTheDocument()
    expect(screen.getByText(/is preparing your order/i)).toBeInTheDocument()
  })

  // --- Status notification: swiper + in_progress ---

  it('swiper sees accepted-order pseudo-message in in_progress state', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({ currentUserId: SWIPER_ID, orderStatus: 'in_progress' })
    expect(
      screen.getByText(
        `You've successfully accepted order #${SHORT_ID}! Take a picture of where you left the order to complete the order.`
      )
    ).toBeInTheDocument()
  })

  it('swiper sees CompletionBanner in in_progress state', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({ currentUserId: SWIPER_ID, orderStatus: 'in_progress' })
    // CompletionBanner renders a "Complete Order" button
    expect(screen.getByRole('button', { name: /complete order/i })).toBeInTheDocument()
  })

  // --- No legacy chrome ---

  it('does not render the subtitle line in any state', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'in_progress' })
    expect(screen.queryByText('Type here to contact your swiper.')).not.toBeInTheDocument()
    expect(screen.queryByText('Contact the orderer in this chat.')).not.toBeInTheDocument()
  })

  it('does not render date separators in the flat thread', () => {
    mockMessages({ conversation: CONVERSATION, messages: [] })
    const { container } = renderView({ currentUserId: ORDERER_ID, orderStatus: 'in_progress' })
    expect(container.querySelector('[data-testid="date-separator"]')).not.toBeInTheDocument()
  })
})
