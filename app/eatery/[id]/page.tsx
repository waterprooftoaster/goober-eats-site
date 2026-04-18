import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EateryHero } from '@/components/eatery-hero'
import { MenuGrid } from '@/components/menu-grid'
import type { MenuGroupWithItems } from '@/lib/types/database'

interface Props {
  params: Promise<{ id: string }>
}

function parseMenuGroups(data: unknown): MenuGroupWithItems[] {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('groups' in data) ||
    !Array.isArray((data as { groups: unknown }).groups)
  ) {
    return []
  }
  return (data as { groups: MenuGroupWithItems[] }).groups
}

export default async function EateryPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [eateryResult, menuResult] = await Promise.all([
    supabase
      .from('eateries')
      .select('id, name, image_url, address')
      .eq('id', id)
      .eq('is_active', true)
      .single(),
    supabase.rpc('get_menu_for_eatery', { eatery_id: id }),
  ])

  if (eateryResult.error || !eateryResult.data) {
    if (eateryResult.error) console.error('Failed to fetch eatery:', eateryResult.error)
    notFound()
  }

  if (menuResult.error) {
    console.error('Failed to fetch menu groups:', menuResult.error)
  }

  const eatery = eateryResult.data
  const groups = parseMenuGroups(menuResult.data)

  return (
    <main className="min-h-screen bg-white pt-2">
      <div className="max-w-[60rem] mx-auto px-4">
        <EateryHero imageUrl={eatery.image_url} alt={eatery.name} />

        <div className="py-5">
          <h1 className="text-2xl font-bold text-gray-900">{eatery.name}</h1>
          <p data-testid="eatery-address" className="mt-1 text-sm text-gray-500">
            {eatery.address}
          </p>
        </div>

        <MenuGrid groups={groups} />
      </div>
    </main>
  )
}
