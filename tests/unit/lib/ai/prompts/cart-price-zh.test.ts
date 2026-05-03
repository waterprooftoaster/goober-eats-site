/**
 * @file cart-price-zh.test.ts
 * @description Asserts the Chinese auto-pricing prompt enforces the rules the
 *   product depends on: multi-image consistency (same restaurant, same total),
 *   cents-conversion example, and JSON-only output. Tests substring presence,
 *   not the whole prompt — small wording tweaks should not break the suite,
 *   but removing a load-bearing rule should.
 *   Called by: vitest
 */

import { describe, it, expect } from 'vitest'
import { CART_PRICE_PROMPT_ZH } from '@/lib/ai/prompts/cart-price-zh'

describe('CART_PRICE_PROMPT_ZH', () => {
  it('is a non-empty string', () => {
    expect(typeof CART_PRICE_PROMPT_ZH).toBe('string')
    expect(CART_PRICE_PROMPT_ZH.length).toBeGreaterThan(50)
  })

  it('mentions multi-image consistency: same restaurant + same total', () => {
    expect(CART_PRICE_PROMPT_ZH).toContain('多图')
    expect(CART_PRICE_PROMPT_ZH).toContain('不同店')
    expect(CART_PRICE_PROMPT_ZH).toContain('不同总额')
  })

  it('rejects non-cart screenshots by returning null', () => {
    expect(CART_PRICE_PROMPT_ZH).toContain('外卖购物车截图')
    expect(CART_PRICE_PROMPT_ZH).toContain('"cents":null')
  })

  it('instructs total over subtotal extraction', () => {
    expect(CART_PRICE_PROMPT_ZH).toContain('Total')
    expect(CART_PRICE_PROMPT_ZH).toContain('Subtotal')
  })

  it('requires integer cents conversion with a worked example', () => {
    expect(CART_PRICE_PROMPT_ZH).toContain('整数美分')
    expect(CART_PRICE_PROMPT_ZH).toMatch(/\$12\.34.*1234/)
  })

  it('demands JSON-only output (no markdown / English / explanations)', () => {
    expect(CART_PRICE_PROMPT_ZH).toContain('只输JSON')
  })
})
