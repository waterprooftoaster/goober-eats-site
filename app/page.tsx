/**
 * @file page.tsx
 * @description Home page displaying active eateries grouped by school.
 *   Auto-seeds the database in development when no eateries are found.
 *   Called by: Next.js routing (direct navigation to /)
 * @dependencies lib/supabase/server.ts, lib/dev-seed.ts, components/eatery-card.tsx
 */

import { createClient } from '@/lib/supabase/server'
import { EateryCard } from '@/components/eatery-card'
import { seedDevEateries } from '@/lib/dev-seed'

/**
 * Fetches active eateries, groups them by school, and renders each as an EateryCard.
 * @returns Eatery grid grouped by school name
 * @called-by Next.js routing (/)
 */
export default async function Home() {
    const supabase = await createClient()

    let { data: eateries } = await supabase
        .from('eateries')
        .select('id, name, image_url, schools(name)')
        .eq('is_active', true)
        .order('name')

    if (process.env.NODE_ENV === 'development' && (!eateries || eateries.length === 0)) {
        await seedDevEateries()
        const { data: seeded } = await supabase
            .from('eateries')
            .select('id, name, image_url, schools(name)')
            .eq('is_active', true)
        eateries = seeded
    }

    const grouped = new Map<string, NonNullable<typeof eateries>>()
    for (const eatery of eateries ?? []) {
        const school = ((eatery.schools as unknown) as { name: string } | null)?.name ?? 'Other'
        if (!grouped.has(school)) grouped.set(school, [])
        grouped.get(school)!.push(eatery)
    }

    return (
        <main className="bg-white space-y-8 p-4">
            {[...grouped.entries()].map(([schoolName, schoolEateries]) => (
                <section key={schoolName}>
                    <h2 className="text-xl tracking-tighter font-bold text-black mb-3">{schoolName}</h2>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                        {schoolEateries.map((eatery) => (
                            <EateryCard
                                key={eatery.id}
                                id={eatery.id}
                                name={eatery.name}
                                imageUrl={eatery.image_url}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </main>
    )
}
