import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import { PendingOrdersList, type PendingOrder } from './pending-orders-list'

export default async function PendingOrdersPage() {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_swiper, school_id')
    .eq('id', user.id)
    .single()

  // Belt-and-suspenders: layout guard should have caught this, but defend explicitly
  if (!profile?.is_swiper) redirect('/account?notice=swiper_required')

  let orders: PendingOrder[] = []

  if (profile?.school_id) {
    const { data: eateries } = await supabase
      .from('eateries')
      .select('id')
      .eq('school_id', profile.school_id)
      .eq('is_active', true)
    const eateryIds = (eateries ?? []).map((e) => e.id)

    if (eateryIds.length > 0) {
      const { data } = await supabase
        .from('orders')
        .select(
          'id, total_cents, tip_cents, items, special_instructions, created_at, eateries!orders_eatery_id_fkey(id, name)'
        )
        .eq('status', 'open')
        .is('swiper_id', null)
        .in('eatery_id', eateryIds)
        .order('created_at', { ascending: true })
      orders = (data ?? []) as unknown as PendingOrder[]
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <h1 className="text-2xl font-bold mb-2">Open Orders</h1>
        <p className="text-sm text-gray-500 mb-8">
          Orders from your school — oldest first. Tap an order to see details and accept it.
        </p>
        <PendingOrdersList orders={orders} />
      </div>
    </main>
  )
}
