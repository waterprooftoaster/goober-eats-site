/**
 * @file route.ts
 * @description Returns option groups and their options for a single menu item.
 *   Groups are resolved via the menu_item_option_group_assignments junction table
 *   so that shared option groups (used by multiple items) are supported.
 *   Called by: frontend menu item modal
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api/helpers'

const paramsSchema = z.object({
  id: z.uuid(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const parsed = paramsSchema.safeParse({ id })
  if (!parsed.success) {
    return apiError('Invalid menu item id', 400)
  }

  const supabase = await createClient()

  // Verify menu item exists
  const { data: menuItem } = await supabase
    .from('menu_items')
    .select('id')
    .eq('id', id)
    .single()

  if (!menuItem) {
    return apiError('Menu item not found', 404)
  }

  // Fetch option groups via junction table, ordered by assignment sort_order
  const { data: assignments, error: assignmentsError } = await supabase
    .from('menu_item_option_group_assignments')
    .select('sort_order, option_group_id, menu_item_option_groups!inner(id, name, selection_type, is_required, sort_order)')
    .eq('menu_item_id', id)
    .order('sort_order')

  if (assignmentsError) {
    return apiError('Failed to fetch option groups', 500)
  }

  if (!assignments || assignments.length === 0) {
    return apiSuccess({ groups: [] })
  }

  const groups = assignments.map((a) => {
    const g = a.menu_item_option_groups as unknown as {
      id: string
      name: string
      selection_type: string
      is_required: boolean
      sort_order: number
    }
    return g
  })
  const groupIds = groups.map((g) => g.id)

  // Fetch all options for these groups ordered by sort_order
  const { data: options, error: optionsError } = await supabase
    .from('menu_item_options')
    .select('id, option_group_id, name, additional_price_cents, is_default, sort_order, linked_menu_item_id')
    .in('option_group_id', groupIds)
    .order('sort_order')

  if (optionsError) {
    return apiError('Failed to fetch options', 500)
  }

  // Nest options into their groups (immutable construction)
  const optionsByGroupId = (options ?? []).reduce<Record<string, typeof options>>((acc, opt) => {
    const existing = acc[opt.option_group_id] ?? []
    return { ...acc, [opt.option_group_id]: [...existing, opt] }
  }, {})

  const groupsWithOptions = groups.map((group) => ({
    ...group,
    options: optionsByGroupId[group.id] ?? [],
  }))

  return apiSuccess({ groups: groupsWithOptions })
}
