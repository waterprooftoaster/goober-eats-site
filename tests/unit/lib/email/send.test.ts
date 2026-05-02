/**
 * @file send.test.ts
 * @description Unit tests for lib/email/send.ts — fire-and-forget Resend wrapper with retry.
 *   Called by: Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockEmailsSend = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: vi.fn() })),
}))

vi.mock('resend', () => ({
  // Must use a regular function (not arrow) so `new Resend()` works
  Resend: vi.fn(function () {
    return { emails: { send: mockEmailsSend } }
  }),
}))

import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail, sendNewOrderToSwipers, sendOrderCancelledEmail } from '@/lib/email/send'

const mockCreateServiceClient = vi.mocked(createServiceClient)

/**
 * Returns a chainable Supabase query builder mock that resolves to { data, error: null }.
 * Supports both direct await (thenable) and .single() terminal call.
 */
function makeSbChain(data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
    then: (res: (v: unknown) => void) => Promise.resolve({ data, error: null }).then(res),
  }
  return q
}

const PARAMS = { to: 'user@test.edu', subject: 'Test', text: 'Hello' }

describe('sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    process.env.RESEND_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.RESEND_API_KEY
  })

  it('sends email with correct params on happy path', async () => {
    mockEmailsSend.mockResolvedValue({ id: 'email-123' })
    sendEmail(PARAMS)
    await vi.advanceTimersByTimeAsync(0)
    expect(mockEmailsSend).toHaveBeenCalledOnce()
    expect(mockEmailsSend).toHaveBeenCalledWith({
      from: 'Goober Eats <noreply@goobereats.net>',
      to: PARAMS.to,
      subject: PARAMS.subject,
      text: PARAMS.text,
    })
  })

  it('schedules retry after 7 s when first attempt fails', async () => {
    mockEmailsSend
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ id: 'email-retry' })

    sendEmail(PARAMS)
    await vi.advanceTimersByTimeAsync(0)

    expect(mockEmailsSend).toHaveBeenCalledOnce()

    // advance time past retry delay
    await vi.advanceTimersByTimeAsync(7_000)
    await vi.advanceTimersByTimeAsync(0)

    expect(mockEmailsSend).toHaveBeenCalledTimes(2)
  })

  it('logs and stops after both attempts fail', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockEmailsSend.mockRejectedValue(new Error('always fails'))

    sendEmail(PARAMS)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(7_000)
    await vi.advanceTimersByTimeAsync(0)

    expect(mockEmailsSend).toHaveBeenCalledTimes(2)
    expect(consoleSpy).toHaveBeenCalledTimes(2)
    consoleSpy.mockRestore()
  })

  it('no-ops and logs when RESEND_API_KEY is missing', () => {
    delete process.env.RESEND_API_KEY
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    sendEmail(PARAMS)
    expect(mockEmailsSend).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledOnce()
    consoleSpy.mockRestore()
  })
})

describe('sendNewOrderToSwipers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    process.env.RESEND_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.RESEND_API_KEY
  })

  it('sends one email per swiper that has an email address', async () => {
    mockEmailsSend.mockResolvedValue({ id: 'e1' })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue(
        makeSbChain([
          { email: 'swiper1@nyu.edu', full_name: 'Swiper One' },
          { email: 'swiper2@nyu.edu', full_name: 'Swiper Two' },
        ])
      ),
    } as unknown as ReturnType<typeof createServiceClient>)

    await sendNewOrderToSwipers({ schoolId: 'school-uuid', restaurantName: 'Chipotle' })
    await vi.advanceTimersByTimeAsync(0)

    expect(mockEmailsSend).toHaveBeenCalledTimes(2)
  })

  it('skips swipers with null email', async () => {
    mockEmailsSend.mockResolvedValue({ id: 'e1' })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue(
        makeSbChain([
          { email: null, full_name: 'No Email' },
          { email: 'swiper@nyu.edu', full_name: 'Has Email' },
        ])
      ),
    } as unknown as ReturnType<typeof createServiceClient>)

    await sendNewOrderToSwipers({ schoolId: 'school-uuid', restaurantName: 'Chipotle' })
    await vi.advanceTimersByTimeAsync(0)

    expect(mockEmailsSend).toHaveBeenCalledTimes(1)
  })

  it('sends no emails when no swipers are found', async () => {
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue(makeSbChain([])),
    } as unknown as ReturnType<typeof createServiceClient>)

    await sendNewOrderToSwipers({ schoolId: 'school-uuid', restaurantName: 'Chipotle' })
    await vi.advanceTimersByTimeAsync(0)

    expect(mockEmailsSend).not.toHaveBeenCalled()
  })
})

describe('sendOrderCancelledEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    process.env.RESEND_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.RESEND_API_KEY
  })

  it('sends cancel confirmation to an authenticated orderer', async () => {
    mockEmailsSend.mockResolvedValue({ id: 'e1' })
    mockCreateServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue(
        makeSbChain({ email: 'alex@nyu.edu', full_name: 'Alex' })
      ),
    } as unknown as ReturnType<typeof createServiceClient>)

    await sendOrderCancelledEmail({
      updated: {
        orderer_id: 'user-uuid',
        guest_email: null,
        guest_name: null,
        restaurant_name: 'Chipotle',
      },
    })
    await vi.advanceTimersByTimeAsync(0)

    expect(mockEmailsSend).toHaveBeenCalledOnce()
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'alex@nyu.edu', subject: expect.stringContaining('Chipotle') })
    )
  })

  it('sends cancel confirmation to a guest using guest_email without a DB call', async () => {
    mockEmailsSend.mockResolvedValue({ id: 'e1' })

    await sendOrderCancelledEmail({
      updated: {
        orderer_id: null,
        guest_email: 'guest@example.com',
        guest_name: 'Guest User',
        restaurant_name: 'Shake Shack',
      },
    })
    await vi.advanceTimersByTimeAsync(0)

    expect(mockEmailsSend).toHaveBeenCalledOnce()
    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'guest@example.com' })
    )
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
  })

  it('no-ops when no email address is available', async () => {
    await sendOrderCancelledEmail({
      updated: {
        orderer_id: null,
        guest_email: null,
        guest_name: null,
        restaurant_name: 'Chipotle',
      },
    })
    await vi.advanceTimersByTimeAsync(0)

    expect(mockEmailsSend).not.toHaveBeenCalled()
  })
})
