/**
 * @file surface.test.tsx
 * @description Render tests for the Surface primitive — verifies testid, tone variants, and asChild polymorphism.
 *   Called by: Vitest
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Surface } from '@/components/ui/surface'

describe('<Surface />', () => {
  it('renders children inside a tagged div with the catalog testid', () => {
    render(<Surface>hello world</Surface>)
    const node = screen.getByTestId('surface')
    expect(node).toBeInTheDocument()
    expect(node).toHaveTextContent('hello world')
    expect(node).toHaveAttribute('data-tone', 'subtle')
    expect(node.tagName.toLowerCase()).toBe('div')
  })

  it('applies the muted tone variant when requested', () => {
    render(<Surface tone="muted">m</Surface>)
    expect(screen.getByTestId('surface')).toHaveAttribute('data-tone', 'muted')
  })

  it('respects asChild and renders the provided element', () => {
    render(
      <Surface asChild>
        <section>section child</section>
      </Surface>
    )
    const node = screen.getByTestId('surface')
    expect(node.tagName.toLowerCase()).toBe('section')
    expect(node).toHaveTextContent('section child')
  })
})
