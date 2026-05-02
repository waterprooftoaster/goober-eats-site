# Claude-in-the-loop live-money recipe

A self-contained recipe for an LLM session (Claude with Playwright MCP browser tools) to drive the full Goober Eats Stripe money flow end-to-end and confirm the test-mode transaction settled. Catches things that selector-based specs miss — broken layout, surprise modals, missing affordances — because the model snapshots after each step and reasons about what it sees before acting.

## What this verifies

1. Orderer can upload a cart screenshot, fill the checkout form, and reach the embedded Stripe Checkout iframe.
2. Stripe processes the test card and the `payment_intent.succeeded` webhook reaches the test dev server.
3. Webhook creates an order in `open` state in the test Supabase.
4. Swiper can see the order in their queue, accept it, mark it complete, and the platform creates a real Stripe Transfer to the swiper's connected account with `source_transaction = chargeId` (so it debits the pending settlement).
5. Platform retains exactly 10% of `total_cents` as the implicit fee (two-step transfer model).

## Bring-up (do this first, in this order)

```bash
# 1. Test Supabase (one-time per boot; leave running)
npm run test:db:up
# Verify: docker ps | grep supabase_kong_test should show port 64361

# 2. Test dev server + stripe listen
eval $(bash scripts/test-money-up.sh)
# This script: validates STRIPE_SECRET_KEY is sk_test_, spawns `npm run dev`
# pointed at the test Supabase on :3100, starts `stripe listen` forwarding to
# that server, captures whsec_, restarts the dev server with STRIPE_WEBHOOK_SECRET
# in its env. The exported STRIPE_WEBHOOK_SECRET is also inherited into your shell.

# 3. (One-time) Auth setup — populates .auth/orderer.json + .auth/swiper.json
RUN_LIVE_MONEY=0 npx playwright test --project=setup
# Or just: npx playwright test --project=setup
```

## Browser flow (Claude executes via Playwright MCP)

After bring-up, perform the steps below. **Snapshot before every decision** — `mcp__playwright__browser_snapshot` returns a structured DOM you can reason over; use it to confirm what's actually on screen before clicking. The acceptance bar is **≥ 6 screenshots** total — this proves observation, not just blind execution.

The model should also call `mcp__playwright__browser_console_messages` after each navigation to catch silent client-side errors that don't fail the page render.

### Step A — Orderer: upload + checkout

1. `mcp__playwright__browser_navigate` to `http://localhost:3100/` (the **test** dev server, NOT 3000).
2. **Snapshot.** Confirm: dropzone visible (`data-testid="home-page"`); no Place Order button yet.
3. `mcp__playwright__browser_file_upload` of `tests/e2e/fixtures/cart-screenshot.png` into the file input (`data-testid="home-file-input"`).
4. **Snapshot.** Confirm: preview rendered, Place Order button now visible (`data-testid="home-place-order-button"`).
5. `mcp__playwright__browser_click` Place Order. URL should become `/checkout`.
6. **Snapshot.** Confirm: checkout page visible (`data-testid="checkout-page"`); cart preview at top.
7. `mcp__playwright__browser_type` "Chipotle" into `#checkout-eatery`.
8. `mcp__playwright__browser_type` "25.00" into `[data-testid="checkout-subtotal-input"]`.
9. **Snapshot.** Confirm: button label reads "Pay $15.00" (or similar — orderer pays 60% of subtotal).
10. `mcp__playwright__browser_click` `[data-testid="checkout-submit-button"]`.
11. **Snapshot + screenshot.** Wait for the embedded Stripe iframe (`data-testid="checkout-stripe-embedded"`) to render. If the iframe doesn't appear within ~5s, check console messages — likely the checkout-session POST failed.

### Step B — Stripe Checkout (use programmatic confirm, not the iframe)

The Stripe iframe is fiddly to drive cross-origin. Instead:

12. Use `mcp__playwright__browser_evaluate` to extract the Checkout session id from the DOM (it's in the iframe's `src` URL). OR call the network log via `mcp__playwright__browser_network_requests` and grep for `/api/stripe/checkout-session` to find the response containing the `clientSecret`. The session id is the `cs_test_xxxx` prefix before `_secret_`.
13. Run a one-shot bash to confirm the PaymentIntent with the magic test PM:
    ```bash
    npx tsx -e "
      import('stripe').then(async (S) => {
        const stripe = new S.default(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve('<cs_test_xxx>');
        const pi = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id;
        await stripe.paymentIntents.confirm(pi, { payment_method: 'pm_card_visa' });
        console.log('confirmed', pi);
      });
    "
    ```
14. The webhook (`stripe listen`) forwards `payment_intent.succeeded` → test dev server creates the order. Wait ~3s.

### Step C — Find the order id

15. Query the test Supabase for the freshly-created order:
    ```bash
    docker exec supabase_db_test psql -U postgres -d postgres -c "select id, status, restaurant_name, total_cents from orders order by created_at desc limit 1"
    ```
    Capture the order id.

### Step D — Swiper: accept + complete

16. Open a fresh browser context with the swiper storage state, OR sign out and sign in as `swiper@goobereats.edu` / `testpassword123`. (For the Playwright MCP tools, the second is usually simpler.)
17. `mcp__playwright__browser_navigate` to `http://localhost:3100/current-orders`.
18. **Snapshot + screenshot.** Confirm the just-created order appears in the queue.
19. `mcp__playwright__browser_click` Accept (use the data-testid for the order's accept button — find it via snapshot).
20. **Snapshot.** Should now be on the chat page for that order; status is `in_progress`.
21. Insert a completion-photo message via psql (the photo upload is orthogonal to the money flow):
    ```bash
    SWIPER_ID=$(docker exec supabase_db_test psql -U postgres -d postgres -tAc "select id from profiles where email='swiper@goobereats.edu'")
    CONV_ID=$(docker exec supabase_db_test psql -U postgres -d postgres -tAc "select id from conversations where order_id='<order_id>'")
    docker exec supabase_db_test psql -U postgres -d postgres -c "insert into messages (conversation_id, sender_id, message_type, image_url) values ('$CONV_ID', '$SWIPER_ID', 'completion_photo', 'https://example.com/done.png')"
    ```
22. `mcp__playwright__browser_click` "Mark as completed" (or whatever the Complete button is labeled — find via snapshot).
23. **Snapshot + screenshot.** Status should now be `completed`. The chat replaces with `OrderCompletedView`.

### Step E — Verify settlement on Stripe

24. Run the assertion CLI:
    ```bash
    npx tsx scripts/assert-order-settled.ts <order_id>
    ```
25. **Expected**: exit 0 with JSON like:
    ```json
    {
      "stripeAssertion": "settled",
      "paymentIntentId": "pi_xxx",
      "chargeId": "ch_xxx",
      "transferId": "tr_xxx",
      "chargeBalanceTxnId": "txn_xxx"
    }
    ```
26. **If it fails**, the JSON includes a clear `error` field — common causes: swiper's Connect account doesn't have `transfers` capability active (re-run `npx tsx scripts/seed.ts` or just re-run `npx playwright test --project=setup`); webhook never arrived (kill+restart `bash scripts/test-money-up.sh`); transfer happened but with wrong amount (genuine bug — investigate).

## Final report format

Claude reports back with this structure:

```json
{
  "orderId": "<uuid>",
  "screenshots": [
    "step-2-home-empty.png",
    "step-4-home-with-preview.png",
    "step-6-checkout-page.png",
    "step-9-checkout-form-filled.png",
    "step-11-stripe-iframe.png",
    "step-18-swiper-queue.png",
    "step-20-chat-in-progress.png",
    "step-23-completed-view.png"
  ],
  "anomalies": [
    "(anything visually off but not a hard fail — e.g. text overflow, missing icon)"
  ],
  "stripeAssertion": "settled",
  "transferId": "tr_xxxxx",
  "chargeBalanceTxnId": "txn_xxxxx"
}
```

## Teardown

```bash
bash scripts/test-money-down.sh        # Stop test dev server + stripe listen
npm run test:db:down                   # Stop test Supabase containers
```
