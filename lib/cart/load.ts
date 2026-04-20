/**
 * @file load.ts
 * @description Loads a cart with enriched item and eatery data for display.
 *   Called by: app/api/cart/route.ts, app/api/stripe/checkout-session/route.ts
 * @dependencies @supabase/supabase-js
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface CartOption {
  id: string
  name: string
  additional_price_cents: number
}

export interface LoadedCartItem {
  id: string
  menu_item_id: string
  name: string
  quantity: number
  price_cents: number
  image_url: string | null
  selected_options: CartOption[]
}

export interface LoadedCart {
  id: string
  eatery_id: string
  eatery_name: string | null
  items: LoadedCartItem[]
}

/**
 * Fetches full cart data including eatery info, item details, and resolved option names.
 * @param service - Service-role Supabase client (bypasses RLS for cross-table reads)
 * @param cart - Minimal cart row with id and eatery_id
 * @returns Fully hydrated LoadedCart ready for display or checkout
 * @called-by app/api/cart/route.ts, app/api/stripe/checkout-session/route.ts
 */
export async function loadCart(
  service: SupabaseClient,
  cart: { id: string; eatery_id: string }
): Promise<LoadedCart> {
  const [{ data: eatery }, { data: rawItems }] = await Promise.all([
    service.from('eateries').select('id, name').eq('id', cart.eatery_id).single(),
    service
      .from('cart_items')
      .select(`
        id,
        menu_item_id,
        quantity,
        selected_options,
        menu_items (
          id,
          name,
          original_price_cents,
          market_price_cents,
          image_url
        )
      `)
      .eq('cart_id', cart.id),
  ])

  const items = rawItems ?? []
  const allOptionIds = items
    .flatMap((item) => (item.selected_options as string[]) ?? [])
    .filter(Boolean)

  const optionMap = new Map<string, CartOption>()
  if (allOptionIds.length > 0) {
    const { data: options } = await service
      .from('menu_item_options')
      .select('id, name, additional_price_cents')
      .in('id', allOptionIds)
    for (const opt of options ?? []) {
      optionMap.set(opt.id, opt)
    }
  }

  const resolvedItems: LoadedCartItem[] = items.map((item) => {
    const mi = item.menu_items as unknown as {
      id: string
      name: string
      original_price_cents: number
      market_price_cents: number | null
      image_url: string | null
    }
    return {
      id: item.id,
      menu_item_id: item.menu_item_id,
      name: mi.name,
      quantity: item.quantity as number,
      price_cents: Math.round(mi.original_price_cents * 0.5),
      image_url: mi.image_url,
      selected_options: (item.selected_options as string[])
        .map((id) => optionMap.get(id))
        .filter((o): o is CartOption => Boolean(o)),
    }
  })

  return {
    id: cart.id,
    eatery_id: cart.eatery_id,
    eatery_name: eatery?.name ?? null,
    items: resolvedItems,
  }
}
