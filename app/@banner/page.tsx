import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import { BannerGuard } from '@/components/banner-guard'

export default async function BannerSlot() {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  const isSwiper = user
    ? ((await supabase.from('profiles').select('is_swiper').eq('id', user.id).single()).data?.is_swiper ?? false)
    : false

  if (isSwiper) return null

  return (
    <BannerGuard>
      <div style={{ backgroundColor: '#000000' }}>
        <div className="px-10 py-8">
          <h2 className="text-2xl font-bold text-white">
            Expiring Meal Swipes? Sell them for 50% off
          </h2>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href={user ? '/account' : '/auth/login'}>Become a Swiper</Link>
            </Button>
          </div>
        </div>
      </div>
    </BannerGuard>
  )
}
