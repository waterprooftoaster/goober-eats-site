/**
 * @file page.tsx
 * @description Renders the unified HomeUpload component for guests arriving from the
 *   cover-page school selector. The component handles its own school-resolution guard
 *   (sessionStorage[PENDING_SCHOOL_ID_KEY] for guests, profile.school_id for authed).
 *   Called by: components/school-search-pill.tsx (router.push('/order/new'))
 * @dependencies components/home-upload.tsx
 */

import HomeUpload from '@/components/home-upload'

export default function OrderNewPage() {
  return <HomeUpload />
}
