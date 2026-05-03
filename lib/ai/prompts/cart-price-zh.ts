/**
 * @file cart-price-zh.ts
 * @description Chinese system prompt for Gemini cart-total extraction.
 *   Written in Chinese because the model receives screenshots that may be
 *   English (GrubHub/Uber Eats) but downstream rules require strict guard
 *   conditions; the bilingual contrast keeps the model from drifting into
 *   commentary. Each numbered rule below is intentional:
 *     1. Reject non-cart screenshots up front so we never hallucinate a total.
 *     2. Multi-image consistency: same restaurant + same final total.
 *        Anything else means the user uploaded inconsistent images and we
 *        should NOT auto-fill (better empty than wrong).
 *     3. Extract the FINAL total (post-tax, post-fee), not the subtotal.
 *     4. Force integer cents so we can compare to Stripe's 50-cent floor and
 *        the $1000 sanity ceiling without float drift.
 *     5. JSON-only output keeps the parser deterministic; markdown / English
 *        explanations would break the schema validator.
 *   Called by: lib/ai/extract-cart-total.ts
 */

export const CART_PRICE_PROMPT_ZH = `看图。不是外卖购物车截图 → {"cents":null,"eatery":null}
多图：不同店或不同总额 → {"cents":null,"eatery":null}
取Total（含税含费，非Subtotal）→ 整数美分（$12.34→1234）
餐厅名匹配下表，用准确名称：
NYU: Jasper Kane, Flavor Lab, Crave NYU, Starbucks, Upstein, Dunkin at U-Hall, True Burger at U-Hall, Peet's Coffee at Kimmel, Cafe 370, Cafe 181, Palladium
TNS: University Center, Taqueria at UC, Café New, 301 Café
无匹配 → eatery: null
只输JSON。无解释。`
