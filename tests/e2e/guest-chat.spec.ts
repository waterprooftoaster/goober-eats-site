/**
 * E2E tests for the guest anonymous auth + Realtime chat flow.
 *
 * These tests verify:
 * 1. Navigating to /order/guest/[id] triggers anon sign-in and opens the chat panel.
 * 2. Messages inserted by the swiper appear via Realtime (no polling).
 * 3. Guests can send messages that are persisted with their anon user ID.
 * 4. Status changes (accept, un-accept, complete) propagate via Realtime to the panel.
 *
 * Runs in the "chromium" (unauthenticated) Playwright project.
 * Swiper actions are simulated directly via the service client to avoid needing
 * the test user's cookie-based session in this project.
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const TEST_EMAIL = 'test@goobereats.test'
// Fixed tokens so tests are deterministic and easy to clean up
const GUEST_TOKEN = '10000000-0000-4000-8000-000000000001'

let swiperUserId: string
let eateryId: string
let menuItemId: string
let menuItemName: string
let menuItemPriceCents: number
let orderId: string

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

type PlaywrightPage = import('@playwright/test').Page
type PlaywrightContext = import('@playwright/test').BrowserContext

/**
 * Set the guest cookie and navigate to the guest order page.
 * After the panel opens (GuestOrderPanelOpener redirects to /), does a
 * second page.goto('/') so the SSR root layout re-renders with the anon
 * user's session cookie — this sets userId in ChatPanelProvider which
 * activates the Realtime subscription for order status changes.
 *
 * The panel auto-reopens on the second navigation because:
 * - ChatPanelProvider.loadActiveOrders() queries orders WHERE anon_user_id = auth.uid()
 * - RLS (orders_select) allows anon users to see their own orders
 * - openPanel() is called with the order's current status
 */
async function openGuestPanel(page: PlaywrightPage, context: PlaywrightContext) {
  await context.addCookies([
    {
      name: `guest_order_token_${orderId}`,
      value: GUEST_TOKEN,
      domain: 'localhost',
      path: '/',
    },
  ])

  // Register the waitForResponse listener BEFORE page.goto so it captures the
  // /api/messages/[orderId] fetch that useMessages triggers after the panel opens.
  // This ensures React state (conversation + messages) is up to date before any
  // caller assertion checks message content in the DOM — preventing flaky failures
  // where assertions run before the async fetch has completed.
  //
  // We wait for the SECOND response because:
  //   1st response: fires when useMessages mounts on first render at /
  //   2nd response: fires after page.goto('/') re-renders with the anon session
  //                 available in SSR cookies (activates Realtime subscription)
  let messagesResponseCount = 0
  const messagesResponsePromise = new Promise<void>((resolve) => {
    page.on('response', (res) => {
      if (res.url().includes(`/api/messages/${orderId}`)) {
        messagesResponseCount++
        if (messagesResponseCount >= 2) resolve()
      }
    })
  })

  await page.goto(`/order/${orderId}`)
  // GuestPanelOpener redirects to / after opening the panel
  const shortId = orderId.slice(0, 8)
  // Use exact match to target only the panel header span, not system message body
  await expect(page.getByText(`Order #${shortId}`, { exact: true })).toBeVisible({ timeout: 15000 })

  // Navigate to / so the SSR root layout re-renders with the anon session cookie,
  // giving ChatPanelProvider a non-null userId which activates the Realtime
  // subscription for order status changes.
  await page.goto('/')
  await expect(page.getByText(`Order #${shortId}`, { exact: true })).toBeVisible({ timeout: 10000 })

  // Wait for the second useMessages fetch to complete so React state is populated
  // before callers assert on message content.
  await Promise.race([
    messagesResponsePromise,
    new Promise<void>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timed out waiting for 2 /api/messages/ responses (got ${messagesResponseCount})`)),
        20000
      )
    ),
  ])
}

/**
 * Simulate the swiper accepting the order by directly updating the DB,
 * creating the conversation, and inserting a system message.
 * This mirrors what /api/orders/[id]/accept does without needing auth cookies.
 */
async function simulateAccept(supabase: ReturnType<typeof makeSupabase>) {
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'in_progress', swiper_id: swiperUserId })
    .eq('id', orderId)
  if (updateError) throw new Error(`simulateAccept update failed: ${updateError.message}`)

  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .upsert(
      { order_id: orderId, orderer_id: null, swiper_id: swiperUserId },
      { onConflict: 'order_id' }
    )
    .select('id')
    .single()
  if (convError || !conv) throw new Error(`simulateAccept conversation failed: ${convError?.message}`)

  return conv.id
}

/**
 * Reset the order back to open (simulates swiper un-accepting).
 */
async function simulateUnaccept(supabase: ReturnType<typeof makeSupabase>) {
  await supabase
    .from('orders')
    .update({ status: 'open', swiper_id: null })
    .eq('id', orderId)
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Guest Anon Auth + Realtime Chat', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    const supabase = makeSupabase()
    await supabase.rpc('seed_dev_eateries')

    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .limit(1)
      .single()
    if (!school) throw new Error('No schools found')

    const { data: item } = await supabase
      .from('menu_items')
      .select('id, name, original_price_cents, restaurant_id')
      .eq('is_available', true)
      .limit(1)
      .single()
    if (!item) throw new Error('No menu items found')
    menuItemId = item.id
    menuItemName = item.name
    menuItemPriceCents = item.original_price_cents

    const { data: eatery } = await supabase
      .from('eateries')
      .select('id')
      .eq('id', item.restaurant_id)
      .eq('school_id', school.id)
      .eq('is_active', true)
      .single()
    if (!eatery) throw new Error('No active eatery found for menu item')
    eateryId = eatery.id

    // Set up the test user as a swiper.
    // Use perPage=200 to handle many anon users created in prior test runs
    // (default page size of 50 may not include the test user).
    const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    const user = usersData?.users.find((u) => u.email === TEST_EMAIL)
    if (!user) throw new Error('Test user not found — run auth.setup.ts first')
    swiperUserId = user.id

    await supabase
      .from('profiles')
      .update({ is_swiper: true, school_id: school.id })
      .eq('id', swiperUserId)

    await supabase.from('stripe_accounts').upsert(
      { user_id: swiperUserId, stripe_account_id: 'acct_guest_chat_e2e', onboarding_complete: true },
      { onConflict: 'user_id' }
    )

    // Create the guest order
    const { data: order } = await supabase
      .from('orders')
      .insert({
        eatery_id: eateryId,
        orderer_id: null,
        swiper_id: null,
        status: 'open',
        items: [
          {
            menu_item_id: menuItemId,
            name: menuItemName,
            price_cents: menuItemPriceCents,
            quantity: 1,
          },
        ],
        total_cents: menuItemPriceCents,
        tip_cents: 0,
        guest_name: 'Guest Chat E2E',
        guest_access_token: GUEST_TOKEN,
      })
      .select('id')
      .single()
    if (!order) throw new Error('Failed to create guest order')
    orderId = order.id

    // Seed a payment so completion checks pass later
    await supabase.from('payments').insert({
      order_id: orderId,
      stripe_payment_intent_id: 'pi_guest_chat_e2e',
      amount_cents: menuItemPriceCents,
      platform_fee_cents: Math.floor(menuItemPriceCents * 0.1),
      status: 'succeeded',
      payer_id: null,
      payee_id: null,
    })
  })

  test.afterAll(async () => {
    const supabase = makeSupabase()
    if (orderId) {
      await supabase.from('orders').delete().eq('id', orderId)
    }
    await supabase.from('stripe_accounts').delete().eq('user_id', swiperUserId)
    await supabase
      .from('profiles')
      .update({ is_swiper: false })
      .eq('id', swiperUserId)

    // Clean up anonymous users created during the test suite to prevent
    // pagination issues in future runs (default listUsers returns 50 per page).
    const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 })
    const anonUsers = usersData?.users.filter((u) => u.is_anonymous === true) ?? []
    for (const anonUser of anonUsers) {
      await supabase.auth.admin.deleteUser(anonUser.id)
    }
  })

  /**
   * Reset order to a clean 'open' state before each test.
   * Each test creates a fresh browser context (new anonymous session), so the
   * anon_user_id from the previous test would block the new session from
   * claiming the order. Reset it here to ensure each test starts clean.
   */
  test.beforeEach(async () => {
    const supabase = makeSupabase()
    // Clear conversations first (cascade deletes messages)
    await supabase.from('conversations').delete().eq('order_id', orderId)
    // Reset order to open state with no linked users
    await supabase
      .from('orders')
      .update({ status: 'open', swiper_id: null, anon_user_id: null })
      .eq('id', orderId)
  })

  // -------------------------------------------------------------------------
  // Test 1: Panel opens, anon sign-in happens, anon_user_id is written to DB
  // -------------------------------------------------------------------------
  test('navigating to /order/[id] with token opens chat panel and sets anon_user_id', async ({ page, context }) => {
    await openGuestPanel(page, context)

    // The panel should be visible at /
    await expect(page).toHaveURL('/')

    // Give the PATCH /api/guest/orders/[id] call time to complete
    await page.waitForTimeout(2000)

    const supabase = makeSupabase()

    // Verify an anonymous user was created in auth.users
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const anonUsers = users.filter((u) => u.is_anonymous === true)
    expect(anonUsers.length).toBeGreaterThan(0)

    // Verify the order now has anon_user_id set
    const { data: order } = await supabase
      .from('orders')
      .select('anon_user_id')
      .eq('id', orderId)
      .single()
    expect(order?.anon_user_id).not.toBeNull()
    // The anon_user_id must match one of the anonymous auth users
    expect(anonUsers.map((u) => u.id)).toContain(order!.anon_user_id)
  })

  // -------------------------------------------------------------------------
  // Test 2: Before accept, panel is open with chat input disabled
  // -------------------------------------------------------------------------
  test('before swiper accepts, panel is open with chat input disabled', async ({ page, context }) => {
    await openGuestPanel(page, context)

    // Panel is open with status 'open' and no conversation yet.
    // After reload, the anon user is authenticated in the SSR layout (userId != null).
    // ChatViewCore renders the empty state with a disabled chat input
    // (disabled because !conversation is true).
    const input = page.getByPlaceholder('Conversation closed')
    await expect(input).toBeVisible({ timeout: 8000 })
    await expect(input).toBeDisabled()

    // The placed-order pseudo-message should be visible in open state
    await expect(page.getByText(/successfully placed order/i)).toBeVisible({ timeout: 5000 })
  })

  // -------------------------------------------------------------------------
  // Test 3: Swiper accepts (order already in_progress when panel opens) →
  //          guest sees conversation and system message on initial load
  // -------------------------------------------------------------------------
  test('when order already accepted, panel shows conversation on initial load', async ({ page, context }) => {
    // Accept the order first so the conversation exists when the panel opens
    const supabase = makeSupabase()
    await simulateAccept(supabase)

    await openGuestPanel(page, context)

    // The in-progress pseudo-message should be visible (client-side, not from DB)
    await expect(page.getByText(/is preparing your order/i)).toBeVisible({ timeout: 15000 })

    // The chat input should now be enabled (conversation exists, status is in_progress)
    await expect(page.getByPlaceholder('Type a message…')).toBeEnabled({ timeout: 5000 })

    // Removed UI chrome should not be present
    await expect(page.getByText('Type here to contact your swiper.')).not.toBeVisible()
    await expect(page.getByText('Contact the orderer in this chat.')).not.toBeVisible()
    await expect(page.getByTestId('date-separator')).not.toBeAttached()

    // Confirm we're still at /
    await expect(page).toHaveURL('/')
  })

  // -------------------------------------------------------------------------
  // Test 4: Message inserted by swiper appears via Realtime (not polling)
  // -------------------------------------------------------------------------
  test('message inserted by swiper appears in panel via Realtime, no polling requests', async ({ page, context }) => {
    // Accept the order first so the conversation exists (useMessages can subscribe)
    const supabase = makeSupabase()
    const conversationId = await simulateAccept(supabase)

    // openGuestPanel waits for the /api/messages/ fetch to complete before returning,
    // so the conversation and system message are already in React state on return.
    await openGuestPanel(page, context)

    // Wait for panel to show the existing system message (initial fetch complete).
    await expect(page.getByText(/is preparing your order/i)).toBeVisible({ timeout: 10000 })

    // Track all HTTP requests after panel is loaded — Realtime uses WebSocket not HTTP
    const pollingRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/guest/messages/')) {
        pollingRequests.push(req.url())
      }
    })

    // Insert a new text message directly via service client (as swiper)
    const testMessage = `Realtime test ${Date.now()}`
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: swiperUserId,
      body: testMessage,
      message_type: 'text',
    })

    // Message should appear in the panel within 5 seconds via Realtime
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 8000 })

    // No polling requests should have been made to /api/guest/messages/
    expect(pollingRequests).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // Test 5: Guest sends a message — appears in thread, persisted with anon_user_id
  // -------------------------------------------------------------------------
  test('guest sends a message and it is persisted with anon sender_id', async ({ page, context }) => {
    // Accept first so conversation exists when panel opens
    const supabasePre = makeSupabase()
    await simulateAccept(supabasePre)

    await openGuestPanel(page, context)

    // Wait for the conversation to be visible
    await expect(page.getByText(/is preparing your order/i)).toBeVisible({ timeout: 10000 })

    // Type and send a message
    const guestMessage = `Hello from guest ${Date.now()}`
    const textarea = page.getByPlaceholder('Type a message…')
    await expect(textarea).toBeEnabled({ timeout: 5000 })
    await textarea.fill(guestMessage)
    await page.getByRole('button', { name: 'Send message' }).click()

    // Message should appear in the thread (added via Realtime after successful POST)
    await expect(page.getByText(guestMessage)).toBeVisible({ timeout: 8000 })

    // Verify in DB: sender_id should equal the anon_user_id on the order.
    // The message appears via Realtime once the INSERT commits, so querying
    // immediately after the UI shows it should find the row.
    const supabase = makeSupabase()
    const { data: order } = await supabase
      .from('orders')
      .select('anon_user_id')
      .eq('id', orderId)
      .single()
    expect(order?.anon_user_id).toBeTruthy()

    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('order_id', orderId)
      .single()
    expect(conv?.id).toBeTruthy()

    // Retry the messages query briefly to handle any minor replication lag
    let sentMsg: { body: string; sender_id: string | null } | undefined
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: messages } = await supabase
        .from('messages')
        .select('body, sender_id')
        .eq('conversation_id', conv!.id)
        .eq('message_type', 'text')
        .order('sent_at', { ascending: false })
        .limit(10)
      sentMsg = messages?.find((m) => m.body === guestMessage)
      if (sentMsg) break
      await new Promise((r) => setTimeout(r, 200))
    }

    expect(sentMsg).toBeDefined()
    expect(sentMsg?.sender_id).toBe(order!.anon_user_id)
  })

  // -------------------------------------------------------------------------
  // Test 6: Swiper un-accepts → panel status updates via Realtime
  // -------------------------------------------------------------------------
  test('swiper un-accepts → panel reverts to waiting state via Realtime', async ({ page, context }) => {
    // First, accept the order so there's an in_progress conversation
    const supabase = makeSupabase()
    await simulateAccept(supabase)

    await openGuestPanel(page, context)

    // Conversation system message should be visible
    await expect(page.getByText(/is preparing your order/i)).toBeVisible({ timeout: 10000 })

    // Simulate un-accept (status → open, swiper_id → null)
    await simulateUnaccept(supabase)

    // Panel should reflect the status change without a page reload.
    // When status reverts to 'open', the placed-order pseudo-message reappears.
    await expect(page.getByText(/successfully placed order/i)).toBeVisible({ timeout: 8000 })

    await expect(page).toHaveURL('/')
    // Verify via DB that status is 'open'
    const { data: order } = await supabase
      .from('orders')
      .select('status, swiper_id')
      .eq('id', orderId)
      .single()
    expect(order?.status).toBe('open')
    expect(order?.swiper_id).toBeNull()
  })

  // -------------------------------------------------------------------------
  // Test 7: Swiper completes the order → panel shows completion view via Realtime
  // -------------------------------------------------------------------------
  test('swiper completes order → panel shows "Order Completed!" view', async ({ page, context }) => {
    // Accept first so conversation exists when panel opens
    const supabase = makeSupabase()
    const conversationId = await simulateAccept(supabase)

    await openGuestPanel(page, context)

    // Wait for conversation to appear
    await expect(page.getByText(/is preparing your order/i)).toBeVisible({ timeout: 10000 })

    // Insert a delivery photo message (required for completion guard)
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: swiperUserId,
      body: null,
      message_type: 'delivery_photo',
      image_url: 'https://placehold.co/200x200',
    })

    // Set the order to completed — triggers Realtime update to ChatPanelProvider
    await supabase
      .from('orders')
      .update({ status: 'completed' })
      .eq('id', orderId)

    // The panel's ChatPanelProvider listens for status updates via Realtime.
    // When status = 'completed', ChatViewCore renders OrderCompletedView.
    await expect(page.getByText('Order Completed!')).toBeVisible({ timeout: 10000 })

    // Confirm we never left the page
    await expect(page).toHaveURL('/')
  })
})
