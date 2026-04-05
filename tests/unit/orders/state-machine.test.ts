import { describe, it, expect } from 'vitest'
import { canTransition } from '@/lib/orders/state-machine'

describe('canTransition', () => {
  // Valid transitions
  it('open → in_progress is valid (swiper accepts)', () => {
    expect(canTransition('open', 'in_progress')).toBe(true)
  })

  it('open → cancelled is valid (orderer cancels)', () => {
    expect(canTransition('open', 'cancelled')).toBe(true)
  })

  it('in_progress → completed is valid', () => {
    expect(canTransition('in_progress', 'completed')).toBe(true)
  })

  it('in_progress → open is valid (swiper un-accepts)', () => {
    expect(canTransition('in_progress', 'open')).toBe(true)
  })

  // Invalid transitions
  it('open → completed is invalid', () => {
    expect(canTransition('open', 'completed')).toBe(false)
  })

  it('in_progress → cancelled is invalid', () => {
    expect(canTransition('in_progress', 'cancelled')).toBe(false)
  })

  it('completed → anything is invalid', () => {
    expect(canTransition('completed', 'open')).toBe(false)
    expect(canTransition('completed', 'in_progress')).toBe(false)
    expect(canTransition('completed', 'cancelled')).toBe(false)
  })

  it('cancelled → anything is invalid', () => {
    expect(canTransition('cancelled', 'open')).toBe(false)
    expect(canTransition('cancelled', 'in_progress')).toBe(false)
    expect(canTransition('cancelled', 'completed')).toBe(false)
  })
})
