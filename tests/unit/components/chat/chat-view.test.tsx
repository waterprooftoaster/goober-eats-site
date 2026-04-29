/**
 * @file chat-view.test.tsx
 * @description Unit tests for ChatView status notification matrix (role × order state).
 *   Called by: Vitest test runner
 * @dependencies @/hooks/use-messages (mocked)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Conversation } from '@/lib/types/messaging'

vi.mock('@/hooks/use-messages', () => ({
  useMessages: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
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
  swiper_assigned_at: null,
  created_at: '2026-04-01T10:00:00Z',
}

const SEND_MESSAGE = vi.fn().mockResolvedValue(undefined)
const APPEND_OPTIMISTIC = vi.fn()
const MARK_FAILED = vi.fn()
const MARK_PENDING = vi.fn()
const REFETCH = vi.fn().mockResolvedValue(undefined)

function mockMessages(overrides: Partial<ReturnType<typeof useMessages>> = {}) {
  vi.mocked(useMessages).mockReturnValue({
    messages: [],
    conversation: null,
    isLoading: false,
    error: null,
    sendMessage: SEND_MESSAGE,
    appendOptimistic: APPEND_OPTIMISTIC,
    markFailed: MARK_FAILED,
    markPending: MARK_PENDING,
    refetch: REFETCH,
    ...overrides,
  })
}

function renderView(props: {
  currentUserId: string | null
  orderStatus: Parameters<typeof ChatView>[0]['orderStatus']
  cartScreenshotUrl?: string | null
}) {
  return render(
    <ChatView
      orderId={ORDER_ID}
      eateryName={EATERY_NAME}
      currentUserId={props.currentUserId}
      orderStatus={props.orderStatus}
      cartScreenshotUrl={props.cartScreenshotUrl ?? null}
    />
  )
}

const CART_URL = 'https://example.com/cart.png'

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

  it('input is disabled when order is open and no conversation exists', () => {
    mockMessages({ conversation: null })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'open' })
    const input = screen.getByTestId('chat-input-waiting')
    expect(input).toBeDisabled()
  })

  it('input is disabled when order has reverted to open after un-accept (conversation still present)', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'open' })
    const input = screen.getByTestId('chat-input-waiting')
    expect(input).toBeDisabled()
  })

  // --- Un-accept pseudo-message (open status with a conversation whose swiper_id is null) ---

  it('orderer sees un-accept pseudo-message when order reverted to open after un-accept', () => {
    mockMessages({
      conversation: { ...CONVERSATION, swiper_id: null, swiper_assigned_at: null },
    })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'open' })
    expect(screen.getByTestId('chat-pseudo-swiper-unavailable')).toHaveTextContent(
      'Swiper is no longer available. Finding you another swiper.'
    )
  })

  it('orderer does NOT see un-accept pseudo-message on a freshly placed order (no conversation)', () => {
    mockMessages({ conversation: null })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'open' })
    expect(screen.queryByTestId('chat-pseudo-swiper-unavailable')).not.toBeInTheDocument()
  })

  it('orderer does NOT see un-accept pseudo-message while in_progress (a swiper is currently assigned)', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'in_progress' })
    expect(screen.queryByTestId('chat-pseudo-swiper-unavailable')).not.toBeInTheDocument()
  })

  it('input is enabled while in_progress', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'in_progress' })
    const input = screen.getByTestId('chat-input-active')
    expect(input).not.toBeDisabled()
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

  it('swiper sees three pseudo-messages (accepted, view-cart, instructions) in in_progress state', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({
      currentUserId: SWIPER_ID,
      orderStatus: 'in_progress',
      cartScreenshotUrl: CART_URL,
    })
    expect(screen.getByTestId('chat-pseudo-accepted')).toHaveTextContent(
      `You've accepted order #${SHORT_ID} at ${EATERY_NAME}! Place the order as detailed in the screenshot.`
    )
    expect(screen.getByTestId('chat-pseudo-view-cart')).toHaveTextContent(
      'Click here to see the order again:'
    )
    expect(screen.getByTestId('chat-pseudo-instructions')).toHaveTextContent(
      `Complete the order by uploading a screenshot of the 'Order placed' confirmation page on GrubHub. Be sure to let the orderer know what name to pick up under!`
    )
  })

  it('swiper sees View cart screenshot button when cartScreenshotUrl is present', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({
      currentUserId: SWIPER_ID,
      orderStatus: 'in_progress',
      cartScreenshotUrl: CART_URL,
    })
    expect(
      screen.getByRole('button', { name: /view cart screenshot/i })
    ).toBeInTheDocument()
  })

  it('swiper does not see the View cart screenshot button when url is null', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({
      currentUserId: SWIPER_ID,
      orderStatus: 'in_progress',
      cartScreenshotUrl: null,
    })
    expect(
      screen.queryByRole('button', { name: /view cart screenshot/i })
    ).not.toBeInTheDocument()
  })

  it('clicking View cart screenshot opens the lightbox dialog', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({
      currentUserId: SWIPER_ID,
      orderStatus: 'in_progress',
      cartScreenshotUrl: CART_URL,
    })
    const dialog = screen.getByTestId('cart-screenshot-lightbox') as HTMLDialogElement
    expect(dialog.open).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /view cart screenshot/i }))
    expect(dialog.open).toBe(true)
  })

  it('swiper sees CompletionBanner in in_progress state', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({ currentUserId: SWIPER_ID, orderStatus: 'in_progress' })
    // CompletionBanner renders a "Complete Order" button
    expect(screen.getByRole('button', { name: /complete order/i })).toBeInTheDocument()
  })

  // --- Status notification: completed (role × view) ---

  it('orderer sees photo + "Your Order is Ready!" label when order is completed and photo is present', () => {
    const photoMsg = {
      id: 'photo-1',
      conversation_id: 'conv-1',
      sender_id: SWIPER_ID,
      body: null,
      message_type: 'completion_photo' as const,
      expires_at: '2026-05-01T00:00:00Z',
      image_url: 'https://cdn.example.com/x.jpg',
      sent_at: '2026-04-26T12:00:00Z',
      temp_id: null,
    }
    mockMessages({ conversation: CONVERSATION, messages: [photoMsg] })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'completed' })
    expect(screen.getByTestId('order-completed-view')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /completion photo/i })).toBeInTheDocument()
    expect(screen.getByText('Your Order is Ready!')).toBeInTheDocument()
    expect(screen.queryByText('Order Completed')).not.toBeInTheDocument()
  })

  it('orderer sees a loading skeleton + label when completed but photo not yet in messages', () => {
    mockMessages({ conversation: CONVERSATION, messages: [] })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'completed' })
    expect(screen.getByTestId('order-completed-view')).toBeInTheDocument()
    expect(screen.getByTestId('order-completed-loading')).toBeInTheDocument()
    expect(screen.getByText('Your Order is Ready!')).toBeInTheDocument()
  })

  it('swiper sees "Order Completed" when order is completed', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({ currentUserId: SWIPER_ID, orderStatus: 'completed' })
    expect(screen.getByTestId('order-completed-view')).toBeInTheDocument()
    expect(screen.getByText('Order Completed')).toBeInTheDocument()
    expect(screen.queryByText('Your Order is Ready!')).not.toBeInTheDocument()
  })

  // --- Swiper clean-slate filter ---
  // Each accept (initial + re-accept) bumps conversations.swiper_assigned_at.
  // Swipers should not see messages older than that timestamp.

  it('swiper does not see messages from before swiper_assigned_at', () => {
    const ASSIGNED_AT = '2026-04-22T10:00:00Z'
    const oldMessage = {
      id: 'old-msg',
      conversation_id: 'conv-1',
      sender_id: ORDERER_ID,
      body: 'pre-cancellation history',
      message_type: 'text' as const,
      sent_at: '2026-04-22T09:00:00Z',
      expires_at: '2026-04-29T09:00:00Z',
      image_url: null,
      temp_id: null,
    }
    const newMessage = {
      id: 'new-msg',
      conversation_id: 'conv-1',
      sender_id: ORDERER_ID,
      body: 'after re-accept',
      message_type: 'text' as const,
      sent_at: '2026-04-22T10:30:00Z',
      expires_at: '2026-04-29T10:30:00Z',
      image_url: null,
      temp_id: null,
    }
    mockMessages({
      conversation: { ...CONVERSATION, swiper_assigned_at: ASSIGNED_AT },
      messages: [oldMessage, newMessage],
    })
    renderView({ currentUserId: SWIPER_ID, orderStatus: 'in_progress' })
    expect(screen.queryByText('pre-cancellation history')).not.toBeInTheDocument()
    expect(screen.getByText('after re-accept')).toBeInTheDocument()
  })

  it('does NOT render completion_photo as an inline chat bubble (CLAUDE.md spec)', () => {
    const photoMsg = {
      id: 'photo-x',
      conversation_id: 'conv-1',
      sender_id: SWIPER_ID,
      body: null,
      message_type: 'completion_photo' as const,
      expires_at: '2026-05-01T00:00:00Z',
      image_url: 'order-id/uuid.jpg',
      sent_at: '2026-04-26T12:00:00Z',
      temp_id: null,
    }
    mockMessages({ conversation: CONVERSATION, messages: [photoMsg] })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'in_progress' })
    // The chat thread should not surface the photo at all in non-completed states.
    expect(screen.queryByRole('img', { name: /completion photo/i })).not.toBeInTheDocument()
  })

  it('orderer always sees full history regardless of swiper_assigned_at', () => {
    const ASSIGNED_AT = '2026-04-22T10:00:00Z'
    const oldMessage = {
      id: 'old-msg',
      conversation_id: 'conv-1',
      sender_id: ORDERER_ID,
      body: 'pre-cancellation history',
      message_type: 'text' as const,
      sent_at: '2026-04-22T09:00:00Z',
      expires_at: '2026-04-29T09:00:00Z',
      image_url: null,
      temp_id: null,
    }
    mockMessages({
      conversation: { ...CONVERSATION, swiper_assigned_at: ASSIGNED_AT },
      messages: [oldMessage],
    })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'in_progress' })
    expect(screen.getByText('pre-cancellation history')).toBeInTheDocument()
  })

  // --- Refetch on completion transition ---
  // Why: the order status UPDATE arrives via chat-panel-provider's separate
  // realtime channel. The completion_photo INSERT arrives via useMessages's
  // channel. They can race, OR the panel was minimized when the photo INSERT
  // fired (ChatView wasn't mounted, INSERT missed). Force a refetch on the
  // in_progress → completed transition so the orderer always sees the picture.

  it('does not refetch when order is mounted in open status', () => {
    mockMessages({ conversation: null })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'open' })
    expect(REFETCH).not.toHaveBeenCalled()
  })

  it('refetches once when mounted in_progress (covers re-accept after un-accept)', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'in_progress' })
    expect(REFETCH).toHaveBeenCalledTimes(1)
  })

  it('refetches once when transitioning open → in_progress, and once again on → completed', () => {
    mockMessages({ conversation: CONVERSATION })
    const { rerender } = renderView({ currentUserId: ORDERER_ID, orderStatus: 'open' })
    expect(REFETCH).not.toHaveBeenCalled()

    rerender(
      <ChatView
        orderId={ORDER_ID}
        eateryName={EATERY_NAME}
        cartScreenshotUrl={null}
        currentUserId={ORDERER_ID}
        orderStatus="in_progress"
      />
    )
    expect(REFETCH).toHaveBeenCalledTimes(1)

    rerender(
      <ChatView
        orderId={ORDER_ID}
        eateryName={EATERY_NAME}
        cartScreenshotUrl={null}
        currentUserId={ORDERER_ID}
        orderStatus="completed"
      />
    )
    expect(REFETCH).toHaveBeenCalledTimes(2)

    // Re-render again with the same completed status — must not refetch again
    rerender(
      <ChatView
        orderId={ORDER_ID}
        eateryName={EATERY_NAME}
        cartScreenshotUrl={null}
        currentUserId={ORDERER_ID}
        orderStatus="completed"
      />
    )
    expect(REFETCH).toHaveBeenCalledTimes(2)
  })

  it('refetches when mounted directly in completed state (covers fresh-mount race)', () => {
    mockMessages({ conversation: CONVERSATION })
    renderView({ currentUserId: ORDERER_ID, orderStatus: 'completed' })
    expect(REFETCH).toHaveBeenCalledTimes(1)
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

  // --- Optimistic-UI flow (S07 C2) ---

  describe('optimistic send flow', () => {
    it('appendOptimistic is called with a UUID temp_id, then sendMessage with the same temp_id', async () => {
      const { userEvent } = await import('@testing-library/user-event')
      const user = userEvent.setup()
      mockMessages({ conversation: CONVERSATION })
      renderView({ currentUserId: ORDERER_ID, orderStatus: 'in_progress' })

      const input = screen.getByTestId('chat-input-active')
      await user.type(input, 'hello world')
      await user.click(screen.getByTestId('chat-send-button'))

      expect(APPEND_OPTIMISTIC).toHaveBeenCalledTimes(1)
      const [tempId, body, senderId] = APPEND_OPTIMISTIC.mock.calls[0]
      expect(typeof tempId).toBe('string')
      expect(tempId.length).toBeGreaterThanOrEqual(8)
      expect(body).toBe('hello world')
      expect(senderId).toBe(ORDERER_ID)

      expect(SEND_MESSAGE).toHaveBeenCalledTimes(1)
      expect(SEND_MESSAGE).toHaveBeenCalledWith('hello world', tempId)
    })

    it('markFailed is called with the same temp_id when sendMessage rejects', async () => {
      const { userEvent } = await import('@testing-library/user-event')
      const user = userEvent.setup()
      SEND_MESSAGE.mockRejectedValueOnce(new Error('boom'))
      mockMessages({ conversation: CONVERSATION })
      renderView({ currentUserId: ORDERER_ID, orderStatus: 'in_progress' })

      const input = screen.getByTestId('chat-input-active')
      await user.type(input, 'will fail')
      await user.click(screen.getByTestId('chat-send-button'))

      // Wait microtask drain for the rejection
      await new Promise((r) => setTimeout(r, 10))

      const [tempId] = APPEND_OPTIMISTIC.mock.calls[0]
      expect(MARK_FAILED).toHaveBeenCalledWith(tempId)
    })
  })
})
