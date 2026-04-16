import type { Message } from '@/lib/types/messaging'

interface Props {
  deliveryPhoto: Message | null
  label?: string
}

export function OrderCompletedView({ deliveryPhoto, label = 'Your order is ready!' }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
      {deliveryPhoto?.image_url && (
        <a
          href={deliveryPhoto.image_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full"
        >
          <img
            src={deliveryPhoto.image_url}
            alt="Delivery photo"
            className="w-full max-h-48 rounded-lg object-cover border border-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
          />
        </a>
      )}
      <p className="text-lg font-semibold text-gray-900">{label}</p>
    </div>
  )
}
