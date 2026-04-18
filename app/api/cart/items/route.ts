/**
 * @file route.ts
 * @description POST endpoint to add an item to the cart. Validates that selected
 *   options belong to the given menu item via the junction table. When an option
 *   has a linked_menu_item_id, also auto-inserts that linked item as a separate
 *   cart row (qty 1, no options) — the option's price delta is not applied.
 *   Called by: frontend add-to-cart button
 * @dependencies lib/supabase/server.ts, lib/supabase/service.ts, lib/api/helpers.ts
 */

import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { addCartItemSchema } from '@/lib/types/api'
import { apiError, apiSuccess, getAuthenticatedUser, getOrCreateSessionId, CART_SESSION_COOKIE } from '@/lib/api/helpers'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = addCartItemSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400)
  }
  const { menu_item_id, selected_options } = parsed.data

  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  const cookieStore = await cookies()
  const service = createServiceClient()

  // Resolve eatery_id from menu item
  const { data: menuItem } = await service
    .from('menu_items')
    .select('id, eatery_id')
    .eq('id', menu_item_id)
    .eq('is_available', true)
    .single()

  if (!menuItem) return apiError('Menu item not found', 404)
  const eatery_id = menuItem.eatery_id

  // Validate options via junction table and collect linked_menu_item_ids
  let linkedItemIds: string[] = []
  if (selected_options.length > 0) {
    // Get all option group ids assigned to this menu item
    const { data: assignments } = await service
      .from('menu_item_option_group_assignments')
      .select('option_group_id')
      .eq('menu_item_id', menu_item_id)

    const assignedGroupIds = (assignments ?? []).map((a) => a.option_group_id)
    if (assignedGroupIds.length === 0) {
      return apiError('One or more selected options are invalid for this item', 400)
    }

    // Validate selected options belong to assigned groups, collect linked ids
    const { data: validOptions } = await service
      .from('menu_item_options')
      .select('id, linked_menu_item_id')
      .in('id', selected_options)
      .in('option_group_id', assignedGroupIds)

    if (!validOptions || validOptions.length !== selected_options.length) {
      return apiError('One or more selected options are invalid for this item', 400)
    }

    linkedItemIds = validOptions
      .map((o) => o.linked_menu_item_id)
      .filter((id): id is string => id !== null)
  }

  // Determine identity: authenticated user or session-based anonymous
  const { sessionId, isNew: isNewSession } = user
    ? { sessionId: undefined, isNew: false }
    : getOrCreateSessionId(cookieStore)

  // Find existing cart for this identity
  let existingCart: { id: string; eatery_id: string } | null = null
  if (user) {
    const { data } = await service
      .from('carts')
      .select('id, eatery_id')
      .eq('user_id', user.id)
      .maybeSingle()
    existingCart = data
  } else {
    const { data } = await service
      .from('carts')
      .select('id, eatery_id')
      .eq('session_id', sessionId!)
      .maybeSingle()
    existingCart = data
  }

  // Reject if cart belongs to a different eatery
  if (existingCart && existingCart.eatery_id !== eatery_id) {
    return apiError('Cart has items from another eatery', 409)
  }

  // Create cart if none exists
  let cartId: string
  if (existingCart) {
    cartId = existingCart.id
  } else {
    const { data: newCart, error: cartError } = await service
      .from('carts')
      .insert({
        user_id: user?.id ?? null,
        session_id: sessionId ?? null,
        eatery_id,
      })
      .select('id, eatery_id')
      .single()

    if (cartError || !newCart) return apiError('Failed to create cart', 500)
    cartId = newCart.id
  }

  // Insert main cart item
  const { data: cartItem, error: itemError } = await service
    .from('cart_items')
    .insert({
      cart_id: cartId,
      menu_item_id,
      quantity: 1,
      selected_options,
    })
    .select('id, cart_id, menu_item_id, quantity, selected_options')
    .single()

  if (itemError || !cartItem) return apiError('Failed to add item to cart', 500)

  // Auto-insert linked items (one row per unique linked_menu_item_id)
  if (linkedItemIds.length > 0) {
    const uniqueLinkedIds = [...new Set(linkedItemIds)]
    const linkedRows = uniqueLinkedIds.map((linkedId) => ({
      cart_id: cartId,
      menu_item_id: linkedId,
      quantity: 1,
      selected_options: [] as string[],
    }))
    const { error: linkedError } = await service.from('cart_items').insert(linkedRows)
    if (linkedError) return apiError('Failed to add linked item to cart', 500)
  }

  const response = apiSuccess({ item: cartItem }, 201)
  if (isNewSession && sessionId) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    response.headers.set(
      'Set-Cookie',
      `${CART_SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax${secure}`
    )
  }
  return response
}
