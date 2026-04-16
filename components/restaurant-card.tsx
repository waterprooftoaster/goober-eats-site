import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface RestaurantCardProps {
    id: string
    name: string
    imageUrl: string | null
}

export function RestaurantCard({ id, name, imageUrl }: RestaurantCardProps) {
    return (
        <Link
            data-testid="restaurant-card"
            href={`/restaurant/${id}`}
            className={cn(
                'group flex w-full flex-col',
                'transition-all duration-200 ease-in-out',
                'hover:scale-[1.02]',
            )}
        >
            {/* Restaurant image*/}
            <div
                className={cn(
                    'relative w-full rounded-xl bg-gray-200',
                    'h-36 overflow-hidden',
                    'transition-shadow duration-200 group-hover:shadow-md',
                )}
            >
                {imageUrl && (
                    <Image
                        src={imageUrl}
                        alt={name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1280px) 33vw, (max-width: 1536px) 25vw, 20vw"
                    />
                )}
            </div>
            {/* Restaurant name */}
            <p className="mt-2 truncate px-0.5 text-lg font-semibold text-black">{name}</p>
        </Link>
    )
}
