import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getStripe } from '@/lib/stripe/client'

interface Props {
  searchParams: Promise<{ session_id?: string }>
}

const SESSION_ID_RE = /^cs_(test|live)_[a-zA-Z0-9]+$/

function FailurePage({ message, href }: { message: string; href: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Payment didn&apos;t go through</h1>
        <p className="text-sm text-gray-500">{message}</p>
        <Link
          href={href}
          className="mt-6 inline-block w-full rounded-none bg-black py-3 text-sm font-semibold text-white hover:bg-gray-900"
        >
          Try again
        </Link>
      </div>
    </div>
  )
}

export default async function CheckoutReturnPage({ searchParams }: Props) {
  const { session_id } = await searchParams

  if (!session_id || !SESSION_ID_RE.test(session_id)) {
    return <FailurePage message="Invalid payment session." href="/checkout" />
  }

  let status: string | null = null
  let isGuest = false
  let piId: string | null = null
  try {
    const session = await getStripe().checkout.sessions.retrieve(session_id)
    status = session.status
    isGuest = session.metadata?.is_guest === 'true'
    piId = typeof session.payment_intent === 'string' ? session.payment_intent : null
  } catch {
    return <FailurePage message="Could not verify payment status. Please try again." href="/checkout" />
  }

  if (status === 'complete') {
    if (isGuest && piId) {
      redirect(`/api/guest/verify-order?pi_id=${piId}`)
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-gray-900">Order placed!</h1>
          <Link
            href="/"
            className="mt-6 inline-block w-full rounded-none bg-black py-3 text-sm font-semibold text-white hover:bg-gray-900"
          >
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <FailurePage
      message="Your card wasn't charged. Please try again."
      href="/checkout"
    />
  )
}
