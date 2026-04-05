'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'

const iconBtnClass = 'rounded-full p-2 text-black transition-colors hover:bg-white'

interface HeaderCartButtonProps {
  itemCount: number
}

export function HeaderCartButton({ itemCount }: HeaderCartButtonProps) {
  const pathname = usePathname()
  if (pathname.startsWith('/checkout')) return null
  return (
    <Link href="/cart" className={`${iconBtnClass} relative`} aria-label="Cart">
      <ShoppingCart className="h-5 w-5" />
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </Link>
  )
}
