/**
 * @file fonts.ts
 * @description Loads the redesign typeface pair (Bricolage Grotesque for display, Figtree for body)
 *   via next/font/google and exposes them as CSS variables consumed by app/globals.css.
 *   Called by: app/layout.tsx
 * @dependencies next/font/google
 */

import { Bricolage_Grotesque, Figtree } from 'next/font/google'

export const bricolageGrotesque = Bricolage_Grotesque({
  variable: '--font-bricolage-grotesque',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const figtree = Figtree({
  variable: '--font-figtree',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})
