/**
 * @file current-orders-list.test.tsx
 * @description Render tests for the /current-orders client list:
 *   empty-state testid, list testid, per-status badge testids + labels.
 *   Called by: Vitest test runner
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import type { OrderStatus } from '@/lib/types/database'

vi.mock('@/components/chat/chat-view', () => ({
  ChatView: ({ orderId, orderStatus, onStatusChange }: { orderId: string; orderStatus: OrderStatus; onStatusChange?: (s: OrderStatus) => void }) => (
    <div data-testid={`chat-view-stub-${orderId}`} data-status={orderStatus}>
      <button
        type="button"
        data-testid={`chat-view-fire-${orderId}`}
        onClick={() => onStatusChange?.('completed')}
      >
        fire-completed
      </button>
    </div>
  ),
}))

const mockPanelState: { orders: Record<string, { status: OrderStatus }> } = { orders: {} }
vi.mock('@/components/chat-panel', () => ({
  useChatPanel: () => ({
    updateOrderStatus: vi.fn(),
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    orders: mockPanelState.orders,
  }),
}))

import { CurrentOrdersList } from '@/app/current-orders/current-orders-list'

const USER_ID = 'user-123'

function buildRow(id: string, status: OrderStatus, restaurantName = 'Chipotle') {
  return { id, status, restaurantName, cartScreenshotUrl: null, conversationId: null }
}

describe('<CurrentOrdersList />', () => {
  beforeEach(() => {
    mockPanelState.orders = {}
  })

  it('renders the empty-state testid when no orders are passed', () => {
    render(<CurrentOrdersList orders={[]} currentUserId={USER_ID} />)
    expect(screen.getByTestId('current-orders-empty-state')).toBeInTheDocument()
    expect(screen.queryByTestId('current-orders-list')).toBeNull()
  })

  it('renders the list testid + a card per order when populated', () => {
    render(
      <CurrentOrdersList
        orders={[
          buildRow('order-aaaa1111-1234-4000-8000-000000000001', 'open'),
          buildRow('order-bbbb2222-1234-4000-8000-000000000002', 'in_progress'),
        ]}
        currentUserId={USER_ID}
      />
    )
    const list = screen.getByTestId('current-orders-list')
    expect(list).toBeInTheDocument()
    expect(within(list).getAllByTestId('current-orders-status-badge')).toHaveLength(2)
  })

  it('shows the right human label for every status', () => {
    render(
      <CurrentOrdersList
        orders={[
          buildRow('id-1', 'open'),
          buildRow('id-2', 'in_progress'),
          buildRow('id-3', 'completed'),
          buildRow('id-4', 'cancelled'),
        ]}
        currentUserId={USER_ID}
      />
    )
    const badges = screen.getAllByTestId('current-orders-status-badge')
    expect(badges[0]).toHaveTextContent('Open')
    expect(badges[1]).toHaveTextContent('In progress')
    expect(badges[2]).toHaveTextContent('Completed')
    expect(badges[3]).toHaveTextContent('Cancelled')
  })

  it('stamps data-status on each badge for E2E reliability', () => {
    render(
      <CurrentOrdersList
        orders={[buildRow('id-1', 'in_progress')]}
        currentUserId={USER_ID}
      />
    )
    const badge = screen.getByTestId('current-orders-status-badge')
    expect(badge).toHaveAttribute('data-status', 'in_progress')
  })

  it('falls back to "Order" when restaurant_name is empty', () => {
    render(
      <CurrentOrdersList
        orders={[{ id: 'id-1', status: 'open', restaurantName: '', cartScreenshotUrl: null, conversationId: null }]}
        currentUserId={USER_ID}
      />
    )
    expect(screen.getByText('Order')).toBeInTheDocument()
  })

  it('keeps a card mounted after onStatusChange("completed") so the swiper can see OrderCompletedView', () => {
    render(
      <CurrentOrdersList
        orders={[buildRow('order-keep', 'in_progress')]}
        currentUserId={USER_ID}
      />
    )
    expect(screen.getByTestId('chat-view-stub-order-keep')).toBeInTheDocument()
    act(() => {
      screen.getByTestId('chat-view-fire-order-keep').click()
    })
    expect(screen.getByTestId('chat-view-stub-order-keep')).toBeInTheDocument()
  })

  it('forwards the live status from the chat-panel-provider to ChatView so completion updates render', () => {
    // Provider's realtime sub flips the status to 'completed' (e.g., the
    // swiper-side completion lands while the orderer is on /current-orders).
    mockPanelState.orders = {
      'order-live': { status: 'completed' },
    }
    render(
      <CurrentOrdersList
        orders={[buildRow('order-live', 'in_progress')]}
        currentUserId={USER_ID}
      />
    )
    // ChatView receives the live 'completed', not the stale server-fetched 'in_progress'.
    expect(screen.getByTestId('chat-view-stub-order-live')).toHaveAttribute(
      'data-status',
      'completed'
    )
    // The status badge in the card header reflects the live status too.
    expect(screen.getByTestId('current-orders-status-badge')).toHaveAttribute(
      'data-status',
      'completed'
    )
  })

  it('falls back to the server-fetched status when the provider has no entry for the order', () => {
    mockPanelState.orders = {} // provider hasn't loaded yet
    render(
      <CurrentOrdersList
        orders={[buildRow('order-fallback', 'in_progress')]}
        currentUserId={USER_ID}
      />
    )
    expect(screen.getByTestId('chat-view-stub-order-fallback')).toHaveAttribute(
      'data-status',
      'in_progress'
    )
  })

  it('updates the rendered status when onStatusChange fires even if the provider never tracks the order (swiper case)', () => {
    // Swiper-side orders are never in panelOrders (chat-panel-provider's
    // loadActiveOrders + realtime filter target orderer_id only), so the
    // provider can't be the source of truth for swipers. ChatView's
    // onStatusChange must still be honored locally so the swiper's UI
    // transitions to OrderCompletedView immediately on completion.
    mockPanelState.orders = {} // provider has no entry — swiper case
    render(
      <CurrentOrdersList
        orders={[buildRow('order-swiper', 'in_progress')]}
        currentUserId={USER_ID}
      />
    )
    expect(screen.getByTestId('chat-view-stub-order-swiper')).toHaveAttribute(
      'data-status',
      'in_progress'
    )
    act(() => {
      screen.getByTestId('chat-view-fire-order-swiper').click()
    })
    expect(screen.getByTestId('chat-view-stub-order-swiper')).toHaveAttribute(
      'data-status',
      'completed'
    )
    expect(screen.getByTestId('current-orders-status-badge')).toHaveAttribute(
      'data-status',
      'completed'
    )
  })

  it('shows a dismiss button only for completed orders and removes the card on click', () => {
    mockPanelState.orders = {
      'order-done': { status: 'completed' },
      'order-active': { status: 'in_progress' },
    }
    render(
      <CurrentOrdersList
        orders={[
          buildRow('order-done', 'in_progress'),
          buildRow('order-active', 'in_progress'),
        ]}
        currentUserId={USER_ID}
      />
    )
    const buttons = screen.getAllByTestId('current-orders-dismiss-button')
    expect(buttons).toHaveLength(1)
    act(() => {
      buttons[0].click()
    })
    expect(screen.queryByTestId('chat-view-stub-order-done')).toBeNull()
    expect(screen.getByTestId('chat-view-stub-order-active')).toBeInTheDocument()
  })
})
