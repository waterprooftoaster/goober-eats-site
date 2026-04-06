/**
 * @file header-wrapper.tsx
 * @description Client shell that controls the header's background color based on scroll position.
 *   Transitions from #F8EABE (matching banner) to white once the banner scrolls out of view.
 *   Called by: app/layout.tsx
 * @dependencies (none beyond React)
 */
'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

interface HeaderWrapperProps {
  hasBanner: boolean
  children: React.ReactNode
}

/**
 * Wraps the server-rendered Header with scroll-driven background color logic.
 * @param hasBanner - Whether the banner slot is rendering content (non-swiper users)
 * @param children - The server-rendered Header component
 * @returns A div with dynamic background that transitions when the banner scrolls away
 * @called-by app/layout.tsx
 */
export function HeaderWrapper({ hasBanner, children }: HeaderWrapperProps) {
  const pathname = usePathname()
  const isHomepage = pathname === '/'
  const [isAtTop, setIsAtTop] = useState(true)

  useEffect(() => {
    if (!hasBanner || !isHomepage) return
    const container = document.getElementById('scroll-container')
    if (!container) return

    const checkScroll = () => {
      // Use the sentinel div's offsetTop as the threshold — when scrollTop reaches it, banner is gone
      const sentinel = document.getElementById('banner-sentinel')
      const threshold = sentinel ? sentinel.offsetTop : 0
      setIsAtTop(container.scrollTop < threshold)
    }

    checkScroll() // run on mount to handle page refresh mid-scroll
    container.addEventListener('scroll', checkScroll, { passive: true })
    return () => container.removeEventListener('scroll', checkScroll)
  }, [hasBanner, isHomepage])

  const bg = hasBanner && isHomepage && isAtTop ? '#F8EABE' : '#ffffff'

  return (
    <div style={{ backgroundColor: bg, transition: 'background-color 0.2s ease' }}>
      {children}
    </div>
  )
}
