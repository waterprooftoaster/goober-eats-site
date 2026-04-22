/**
 * @file order-card.test.tsx
 * @description Unit tests for OrderCard component.
 *   Called by: Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={(props.alt as string) ?? ''} />
  },
}))

const { OrderCard } = await import('@/components/order/order-card')

const BASE_ORDER = {
  id: 'order-1',
  restaurant_name: 'Chipotle',
  total_cents: 1500,
  cart_screenshot_urls: ['https://example.com/cart.jpg'],
  created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
}

describe('OrderCard', () => {
  it('renders the restaurant name', () => {
    render(<OrderCard order={BASE_ORDER} onClick={vi.fn()} />)
    expect(screen.getByText('Chipotle')).toBeInTheDocument()
  })

  it('renders the total formatted as dollars', () => {
    render(<OrderCard order={BASE_ORDER} onClick={vi.fn()} />)
    expect(screen.getByText('$15.00')).toBeInTheDocument()
  })

  it('renders a thumbnail when cart_screenshot_urls[0] is present', () => {
    render(<OrderCard order={BASE_ORDER} onClick={vi.fn()} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/cart.jpg')
  })

  it('renders an age string derived from created_at', () => {
    render(<OrderCard order={BASE_ORDER} onClick={vi.fn()} />)
    expect(screen.getByText(/ago/)).toBeInTheDocument()
  })

  it('calls onClick when the card is clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<OrderCard order={BASE_ORDER} onClick={onClick} />)
    await user.click(screen.getByTestId('order-card'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders without crashing when cart_screenshot_urls is empty', () => {
    render(
      <OrderCard
        order={{ ...BASE_ORDER, cart_screenshot_urls: [] }}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByText('Chipotle')).toBeInTheDocument()
    expect(screen.queryByRole('img')).toBeNull()
  })
})
