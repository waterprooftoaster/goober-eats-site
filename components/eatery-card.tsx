import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface EateryCardProps {
    id: string
    name: string
    imageUrl: string | null
}

export function EateryCard({ id, name, imageUrl }: EateryCardProps) {
    return (
        <Link
            data-testid="eatery-card"
            href={`/eatery/${id}`}
            className={cn(
                'group flex w-full flex-col',
                'transition-all duration-200 ease-in-out',
                'hover:scale-[1.02]',
            )}
        >
            {/* Eatery image*/}
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
            {/* Eatery name */}
            <p className="mt-2 truncate px-0.5 text-lg font-semibold text-black">{name}</p>
        </Link>
    )
}
