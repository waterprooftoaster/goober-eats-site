/**
 * @file current-orders-list.test.tsx
 * @description Render tests for the /current-orders client list:
 *   empty-state testid, list testid, per-status badge testids + labels.
 *   Called by: Vitest test runner
 */

import { vi, describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('@/components/chat/chat-view', () => ({
  ChatView: ({ orderId }: { orderId: string }) => (
    <div data-testid={`chat-view-stub-${orderId}`} />
  ),
}))

vi.mock('@/components/chat-panel', () => ({
  useChatPanel: () => ({
    updateOrderStatus: vi.fn(),
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    toggleMinimize: vi.fn(),
    orders: {},
  }),
}))

import { CurrentOrdersList } from '@/app/current-orders/current-orders-list'
import type { OrderStatus } from '@/lib/types/database'

const USER_ID = 'user-123'

function buildRow(id: string, status: OrderStatus, restaurantName = 'Chipotle') {
  return { id, status, restaurantName }
}

describe('<CurrentOrdersList />', () => {
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
        orders={[{ id: 'id-1', status: 'open', restaurantName: '' }]}
        currentUserId={USER_ID}
      />
    )
    expect(screen.getByText('Order')).toBeInTheDocument()
  })
})
