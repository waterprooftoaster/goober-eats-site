/**
 * @file use-visibility-refetch.test.ts
 * @description TDD-first specs for hooks/use-visibility-refetch.ts. The hook
 *   wires a refetch callback to the document.visibilitychange event so a
 *   backgrounded tab returning to foreground reconciles state that the
 *   Realtime WebSocket may have missed during heartbeat suspension.
 *   Per master plan §11.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useVisibilityRefetch } from '@/hooks/use-visibility-refetch'

describe('useVisibilityRefetch', () => {
  let visibilitySpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    visibilitySpy?.mockRestore()
  })

  it('fires the callback when visibilitychange flips to "visible"', () => {
    const refetch = vi.fn()
    renderHook(() => useVisibilityRefetch(refetch))

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire the callback when visibilitychange flips to "hidden"', () => {
    const refetch = vi.fn()
    renderHook(() => useVisibilityRefetch(refetch))

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(refetch).not.toHaveBeenCalled()
  })

  it('removes the listener on unmount (subsequent visibility events do not fire refetch)', () => {
    const refetch = vi.fn()
    const { unmount } = renderHook(() => useVisibilityRefetch(refetch))

    unmount()

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(refetch).not.toHaveBeenCalled()
  })

  it('rebinds the listener when the refetch identity changes', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ fn }) => useVisibilityRefetch(fn), {
      initialProps: { fn: first },
    })

    rerender({ fn: second })

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
