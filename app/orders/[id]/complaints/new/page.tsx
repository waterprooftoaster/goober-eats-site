/**
 * @file page.tsx
 * @description Server component for the order complaint form. Gates access
 *   end-to-end: redirects unauthenticated users to /auth/login, returns an
 *   ineligible-state surface when the order is not the caller's, not
 *   completed, outside the 24h window, or already has a complaint. Hands
 *   `orderId`, `restaurantName`, `totalCents` to the client form on success.
 *   Called by: Next.js routing (/orders/[id]/complaints/new)
 * @dependencies lib/supabase/server.ts, lib/api/helpers.ts,
 *   lib/orders/complaint-eligibility.ts, components/orders/complaint-form
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/api/helpers'
import { isWithinComplaintWindow } from '@/lib/orders/complaint-eligibility'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { ComplaintForm } from '@/components/orders/complaint-form'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Renders the complaint form (or an ineligible-state surface).
 * @param params - Route params containing the order UUID
 * @returns The complaint form for eligible orders, otherwise an explainer
 * @called-by Next.js routing
 */
export default async function NewComplaintPage({ params }: PageProps) {
  const { id: orderId } = await params

  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) redirect('/auth/login')

  const { data: order } = await supabase
    .from('orders')
    .select('id, orderer_id, status, completed_at, restaurant_name, total_cents, complaints(id, verdict)')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) {
    return <Ineligible heading="Order not found" body="We couldn't find that order." />
  }

  if (order.orderer_id !== user.id) {
    return <Ineligible heading="Not your order" body="Only the orderer can file a complaint." />
  }

  if (order.status !== 'completed') {
    return (
      <Ineligible
        heading="Order not yet completed"
        body="You can file a complaint after your swiper marks the order complete."
      />
    )
  }

  if (!isWithinComplaintWindow(order.completed_at)) {
    return (
      <Ineligible
        heading="Window closed"
        body="The 24-hour complaint window for this order has expired."
      />
    )
  }

  const existing = pickComplaint(order.complaints)
  if (existing) {
    return (
      <Ineligible
        heading="Complaint already filed"
        body="A complaint has already been filed for this order. We'll follow up when it's resolved."
      />
    )
  }

  return (
    <main
      data-testid="new-complaint-page"
      className="mx-auto flex max-w-xl flex-col gap-6 py-8 sm:py-12"
    >
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Report a problem.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us what went wrong with your order from {order.restaurant_name}. We&rsquo;ll review the cart screenshots and the swiper&rsquo;s completion photo automatically.
        </p>
      </header>

      <ComplaintForm
        orderId={orderId}
        restaurantName={order.restaurant_name}
        totalCents={order.total_cents}
      />
    </main>
  )
}

// --- Helpers ---

interface IneligibleProps {
  heading: string
  body: string
}

function Ineligible({ heading, body }: IneligibleProps) {
  return (
    <main
      data-testid="new-complaint-ineligible"
      className="mx-auto flex max-w-xl flex-col gap-6 py-8 sm:py-12"
    >
      <Surface tone="subtle" padding="lg" className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div>
          <Button asChild variant="outline" size="sm">
            <Link href="/orders">Back to your orders</Link>
          </Button>
        </div>
      </Surface>
    </main>
  )
}

interface ComplaintRel {
  id: string
  verdict: string
}

function pickComplaint(raw: ComplaintRel[] | ComplaintRel | null | undefined): ComplaintRel | null {
  if (raw == null) return null
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw
}
