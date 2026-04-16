/**
 * @file header-wrapper.tsx
 * @description Client shell that renders the header with a fixed black background.
 *   Called by: app/layout.tsx
 * @dependencies (none beyond React)
 */
'use client'

interface HeaderWrapperProps {
  hasBanner: boolean
  children: React.ReactNode
}

/**
 * Wraps the server-rendered Header with a black background.
 * @param hasBanner - Unused; kept for layout.tsx prop compatibility
 * @param children - The server-rendered Header component
 * @returns A div with a black background wrapping the header
 * @called-by app/layout.tsx
 */
export function HeaderWrapper({ children }: HeaderWrapperProps) {
  return (
    <div className="sticky top-0 z-50" style={{ backgroundColor: '#000000' }}>
      {children}
    </div>
  )
}
