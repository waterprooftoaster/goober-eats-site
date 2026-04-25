'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BannerProps {
    isSwiper: boolean
    isLoggedIn: boolean
}

export function Banner({ isSwiper, isLoggedIn }: BannerProps) {
    const pathname = usePathname()
    if (isSwiper || pathname !== '/') return null

    return (
        <div data-testid="become-swiper-banner" className="bg-black">
            <div className="max-w-[1200px] mx-auto px-6 py-10">
                <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
                    <Zap className="h-8 w-8 text-[#A1C935] shrink-0" />
                    Expiring Meal Swipes? <br /> Earn from your phone.
                </h2>
                <div className="mt-5">
                    <Button asChild variant="primary">
                        <Link href={isLoggedIn ? '/account' : '/auth/login'}>Become a Swiper</Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
