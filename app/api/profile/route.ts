import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { updateProfileSchema } from '@/lib/types/api'
import { apiError, apiSuccess, getAuthenticatedUser } from '@/lib/api/helpers'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)
  if (!user) return apiError('Unauthorized', 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body', 400)
  }

  const parsed = updateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400)
  }

  const { school_id, is_swiper } = parsed.data

  if (is_swiper === false) {
    // Prevent deactivation while orders are in progress
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('swiper_id', user.id)
      .in('status', ['in_progress'])
    if (count && count > 0) {
      return apiError('Cannot deactivate swiper status while orders are in progress', 422)
    }
  }

  if (is_swiper === true) {
    // Fetch current profile to get effective school_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .maybeSingle()

    const effectiveSchoolId = school_id ?? profile?.school_id
    if (!effectiveSchoolId) {
      return apiError('School must be selected before activating swiper status', 422)
    }

    // Verify the school actually exists (gives a clear error vs generic FK failure)
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .eq('id', effectiveSchoolId)
      .single()
    if (!school) return apiError('School not found', 422)

    // Check Stripe onboarding
    const { data: stripeAccount } = await supabase
      .from('stripe_accounts')
      .select('onboarding_complete')
      .eq('user_id', user.id)
      .single()

    if (!stripeAccount?.onboarding_complete) {
      return apiError(
        'Payment account setup must be complete before activating swiper status',
        422
      )
    }
  }

  // Build immutable updates object — only include provided fields.
  // updated_at is managed by the DB trigger.
  const updates: Record<string, unknown> = {}
  if (school_id !== undefined) updates.school_id = school_id
  if (is_swiper !== undefined) updates.is_swiper = is_swiper

  // is_swiper column has REVOKE UPDATE FROM authenticated — must use service role
  // for any update that touches it. For non-is_swiper updates, authenticated client
  // is fine (user can only update their own row via RLS).
  const writeClient = is_swiper !== undefined ? createServiceClient() : supabase

  const { data: updated, error } = await writeClient
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .maybeSingle()

  if (error) return apiError(
    process.env.NODE_ENV === 'development'
      ? `Failed to update profile: ${error.message}`
      : 'Failed to update profile',
    500,
  )
  if (!updated) return apiError('Profile not found — complete account setup first', 404)
  return apiSuccess(updated)
}
