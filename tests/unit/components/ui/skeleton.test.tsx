/**
 * @file skeleton.test.tsx
 * @description Render tests for the Skeleton primitive.
 *   Called by: Vitest
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Skeleton } from '@/components/ui/skeleton'

describe('<Skeleton />', () => {
  it('renders with the catalog testid and animation classes', () => {
    render(<Skeleton className="h-6 w-24" />)
    const node = screen.getByTestId('skeleton')
    expect(node).toBeInTheDocument()
    expect(node).toHaveAttribute('aria-hidden', 'true')
    expect(node.className).toMatch(/animate-pulse/)
    expect(node.className).toMatch(/motion-reduce:animate-none/)
    expect(node.className).toMatch(/h-6/)
    expect(node.className).toMatch(/w-24/)
  })
})
