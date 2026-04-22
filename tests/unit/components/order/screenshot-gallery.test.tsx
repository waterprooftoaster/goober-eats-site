/**
 * @file screenshot-gallery.test.tsx
 * @description Unit tests for ScreenshotGallery component.
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

const { ScreenshotGallery } = await import('@/components/order/screenshot-gallery')

const URLS = [
  'https://example.com/cart1.jpg',
  'https://example.com/cart2.jpg',
]

describe('ScreenshotGallery', () => {
  it('renders nothing when urls is empty', () => {
    const { container } = render(<ScreenshotGallery urls={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders one thumbnail per URL', () => {
    render(<ScreenshotGallery urls={URLS} />)
    expect(screen.getAllByRole('img')).toHaveLength(URLS.length)
  })

  it('opens the lightbox when a thumbnail is clicked', async () => {
    const user = userEvent.setup()
    render(<ScreenshotGallery urls={URLS} />)
    const thumbnails = screen.getAllByRole('button')
    await user.click(thumbnails[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows the clicked image in the lightbox', async () => {
    const user = userEvent.setup()
    render(<ScreenshotGallery urls={URLS} />)
    const thumbnails = screen.getAllByRole('button')
    await user.click(thumbnails[1])
    const lightboxImg = screen.getByRole('dialog').querySelector('img')
    expect(lightboxImg).toHaveAttribute('src', URLS[1])
  })

  it('closes the lightbox when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    render(<ScreenshotGallery urls={URLS} />)
    await user.click(screen.getAllByRole('button')[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const backdrop = screen.getByLabelText('Close gallery')
    await user.click(backdrop)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows prev/next navigation when multiple images exist', async () => {
    const user = userEvent.setup()
    render(<ScreenshotGallery urls={URLS} />)
    await user.click(screen.getAllByRole('button')[0])
    expect(screen.getByRole('button', { name: /prev/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
  })

  it('does not show prev/next navigation for a single image', async () => {
    const user = userEvent.setup()
    render(<ScreenshotGallery urls={[URLS[0]]} />)
    await user.click(screen.getByRole('button'))
    expect(screen.queryByRole('button', { name: /prev/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /next/i })).toBeNull()
  })

  it('navigates to the next image via the next button', async () => {
    const user = userEvent.setup()
    render(<ScreenshotGallery urls={URLS} />)
    await user.click(screen.getAllByRole('button')[0])
    await user.click(screen.getByRole('button', { name: /next/i }))
    const lightboxImg = screen.getByRole('dialog').querySelector('img')
    expect(lightboxImg).toHaveAttribute('src', URLS[1])
  })
})
