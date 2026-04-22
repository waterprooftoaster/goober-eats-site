/**
 * @file page.tsx
 * @description Home page placeholder. The eatery-browsing home grid was removed
 *   in the GrubHub-screenshot pivot; post-pivot orders originate from the
 *   upload flow, not an eatery grid. Frontend discovery UX is being rebuilt
 *   on a separate branch.
 *   Called by: Next.js routing (direct navigation to /)
 */

/**
 * Renders a minimal home placeholder while the new upload-driven ordering UI is rebuilt.
 * @returns Placeholder home page
 * @called-by Next.js routing (/)
 */
export default function Home() {
    return (
        <main className="bg-white space-y-4 p-4">
            <h1 className="text-xl tracking-tighter font-bold text-black">goober Eats</h1>
            <p className="text-sm text-gray-600">
                Ordering is being updated. Check back soon.
            </p>
        </main>
    )
}
