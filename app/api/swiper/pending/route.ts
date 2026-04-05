import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'

export async function GET() {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) return apiError('Unauthorized', 401)

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_swiper, school_id')
    .eq('id', user.id)
    .single()
  if (!profile?.is_swiper) return apiError('Forbidden', 403)
  // No school set — return empty rather than error; swiper should set a school
  if (!profile.school_id) return apiSuccess([])

  // Resolve active eatery IDs for the swiper's school (server-side only — never
  // accept school_id as a query parameter to prevent school spoofing)
  const { data: eateries } = await supabase
    .from('eateries')
    .select('id')
    .eq('school_id', profile.school_id)
    .eq('is_active', true)
  const eateryIds = (eateries ?? []).map((e) => e.id)
  if (eateryIds.length === 0) return apiSuccess([])

  // Pending unaccepted orders for those eateries, oldest first (fair queue)
  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, total_cents, tip_cents, items, special_instructions, created_at, eateries!orders_eatery_id_fkey(id, name)'
    )
    .eq('status', 'open')
    .is('swiper_id', null)
    .in('eatery_id', eateryIds)
    .order('created_at', { ascending: true })

  if (error) return apiError('Failed to fetch pending orders', 500)
  return apiSuccess(orders ?? [])
}
