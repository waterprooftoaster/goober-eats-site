import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const TEST_EMAIL = 'test@goobereats.test'

test.describe('Pending Orders', () => {
  test.beforeAll(async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    await supabase.rpc('seed_dev_eateries')
    const { data: schools } = await supabase
      .from('schools')
      .select('id')
      .limit(1)
      .single()
    if (!schools) throw new Error('No schools found')

    const { data: existing } = await supabase.auth.admin.listUsers()
    const user = existing?.users?.find((u) => u.email === TEST_EMAIL)
    if (!user) throw new Error('Test user not found')

    await supabase
      .from('profiles')
      .update({ is_swiper: true, school_id: schools.id })
      .eq('id', user.id)
  })

  test.afterAll(async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data: existing } = await supabase.auth.admin.listUsers()
    const user = existing?.users?.find((u) => u.email === TEST_EMAIL)
    if (user) {
      await supabase
        .from('profiles')
        .update({ is_swiper: false })
        .eq('id', user.id)
    }
  })

  test('GET /api/swiper/pending returns 200 with array', async ({ request }) => {
    const res = await request.get('/api/swiper/pending')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('page loads and shows Open Orders heading', async ({ page }) => {
    await page.goto('/swiper/orders')
    await expect(page.getByRole('heading', { name: 'Open Orders' })).toBeVisible()
  })

  test('sidebar shows Pending Orders link', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /pending orders/i })).toBeVisible()
  })
})
