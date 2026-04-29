'use client'

/**
 * @file guest-home-router.tsx
 * @description Client wrapper for the unauthenticated home view. Renders the
 *   CoverPage on the server + first paint to keep first-time guests on the
 *   school selector with no flash. After hydration, if the
 *   `pending_school_id` sessionStorage key is set (i.e. the guest has already
 *   picked a school), it swaps to HomeUpload — which in turn handles the
 *   guest upload flow off the same key.
 *   Called by: app/page.tsx (unauthenticated branch)
 * @dependencies components/cover-page.tsx, components/home-upload.tsx,
 *   lib/constants.ts
 */

import { useSyncExternalStore } from 'react'
import CoverPage from '@/components/cover-page'
import HomeUpload from '@/components/home-upload'
import { PENDING_SCHOOL_ID_KEY } from '@/lib/constants'

interface School {
  id: string
  name: string
}

interface GuestHomeRouterProps {
  schools: School[]
}

/**
 * Renders CoverPage by default and switches to HomeUpload after mount when the
 * guest has a school stored in sessionStorage.
 * @param schools - Schools list to forward to CoverPage when shown
 * @returns Either CoverPage (no school selected) or HomeUpload (school selected)
 * @called-by app/page.tsx
 */
export default function GuestHomeRouter({ schools }: GuestHomeRouterProps) {
  const hasSchool = useSyncExternalStore(
    subscribePendingSchool,
    getPendingSchoolSnapshot,
    getPendingSchoolServerSnapshot,
  )

  if (hasSchool) {
    return <HomeUpload />
  }
  return <CoverPage schools={schools} />
}

// --- Helpers ---

function subscribePendingSchool(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function getPendingSchoolSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(window.sessionStorage.getItem(PENDING_SCHOOL_ID_KEY))
}

function getPendingSchoolServerSnapshot(): boolean {
  return false
}
