/**
 * @file total-input.test.tsx
 * @description Unit tests for TotalInput component.
 *   Called by: Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TotalInput } from '@/components/order/total-input'

describe('TotalInput', () => {
  it('renders an input element', () => {
    const onChange = vi.fn()
    render(<TotalInput valueCents={null} onChange={onChange} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('displays valueCents as decimal string on render', () => {
    const onChange = vi.fn()
    render(<TotalInput valueCents={1250} onChange={onChange} />)
    expect(screen.getByRole('textbox')).toHaveValue('12.50')
  })

  it('shows empty when valueCents is null', () => {
    const onChange = vi.fn()
    render(<TotalInput valueCents={null} onChange={onChange} />)
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('calls onChange with cents on blur after typing a valid amount', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TotalInput valueCents={null} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.type(input, '12.50')
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(1250)
  })

  it('calls onChange(null) when field is cleared and blurred', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TotalInput valueCents={500} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await user.clear(input)
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('calls onChange(null) when value parses to zero', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TotalInput valueCents={null} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.type(input, '0')
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('strips non-numeric characters and converts correctly', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TotalInput valueCents={null} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.type(input, 'abc5.00xyz')
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(500)
  })

  it('is disabled when disabled prop is true', () => {
    const onChange = vi.fn()
    render(<TotalInput valueCents={null} onChange={onChange} disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})
