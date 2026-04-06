import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'

export default async function BannerSlot() {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  const isSwiper = user
    ? ((await supabase.from('profiles').select('is_swiper').eq('id', user.id).single()).data?.is_swiper ?? false)
    : false

  if (isSwiper) return null

  return (
    <div className="flex bg-white">
      <div className="hidden lg:block w-44 shrink-0" />
      <div className="flex-1 min-w-0 px-6 py-8 pl-10">
        <h2 className="text-2xl font-bold text-gray-900">
          Expiring Meal Swipes? Sell them for 50% off
        </h2>
        <div className="mt-4">
          <Button asChild>
            <Link href={user ? '/account' : '/auth/login'}>Become a Swiper</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
