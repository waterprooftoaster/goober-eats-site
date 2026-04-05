import type { Message } from '@/lib/types/messaging'

interface Props {
  deliveryPhoto: Message | null
  onClose: () => void
}

export function OrderCompletedView({ deliveryPhoto, onClose }: Props) {
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
      <p className="text-lg font-semibold text-gray-900">Order Completed!</p>
      <button
        onClick={onClose}
        className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
      >
        Close
      </button>
    </div>
  )
}
