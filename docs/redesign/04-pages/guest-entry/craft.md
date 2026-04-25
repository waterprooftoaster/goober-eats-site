# `/order/[orderId]` — Craft

## Anatomy

```
// page.tsx (server component)
async function OrderPage({ params }) {
  const { orderId } = await params
  if (!uuidSchema.safeParse(orderId).success) redirect('/')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')
  const cookieStore = await cookies()
  const token = cookieStore.get(guestOrderCookieName(orderId))?.value
  if (!token) redirect('/')
  const serviceClient = createServiceClient()
  const { data: order } = await serviceClient
    .from('orders')
    .select('id, status, guest_access_token, orderer_id, restaurant_name')
    .eq('id', orderId)
    .maybeSingle()
  if (!order || order.guest_access_token !== token || order.orderer_id !== null) redirect('/')
  return <GuestPanelOpener orderId={...} initialStatus={...} eateryName={order.restaurant_name ?? ''} />
}

// guest-panel-opener.tsx (client component)
<main data-testid="guest-panel-opener" min-h-screen flex items-center justify-center>
  <div data-testid="guest-bootstrap-spinner"
       className="size-6 animate-spin rounded-full border-2 border-border border-t-foreground"
       role="status" aria-label="Opening your order…" />
</main>
```

## Decisions

- **Schema fix: `restaurant_name` replaces stale `eateries(name)` join.**
  The eateries table was removed in the domain-model rewrite (per
  CLAUDE.md "Domain Model" section); `orders.restaurant_name` is the
  free-text column that replaced it. The S01 markup still selected
  `eateries(name)` and cast its `null` fallback to `''` — silently
  broken. Fixing as part of the redesign rebuild.
- **Spinner uses OKLCH tokens.** `border-border` (tinted neutral
  ring) + `border-t-foreground` (the moving arc). Replaces the S01
  hard-coded `border-gray-300 / border-t-gray-900`. Honors the
  `.impeccable.md` "tinted neutrals at chroma 0.007" rule.
- **`<main>` + `data-testid="guest-panel-opener"` on the root.**
  S01 used a `<div>`; promoting to `<main>` gives the page proper
  landmark semantics for the brief moment it's visible. Testid is
  unchanged, so Playwright still resolves the same node.
- **`role="status"` + `aria-label` on the spinner.** Announces the
  transient page to assistive tech without requiring visible text.
  Visible text would just flash and disappear.
- **`size-6` (24×24px)** keeps the visual scale identical to S01.
- **No Surface wrapping.** The page is a flash; adding a Surface
  would visually flag the page as a destination, which it isn't.
- **`useChatPanel()` integration unchanged.** `openPanel(orderId,
  initialStatus, eateryName)` is the same call. The panel state
  lives in the global `ChatPanelProvider` so the panel stays open
  after `router.replace('/')` resolves.
- **PATCH endpoint unchanged.** Frozen per master plan §9. The
  `{ anon_user_id }` request body and the fire-and-forget error
  handling are preserved.

## Behavior preserved (unchanged from S01)

- UUID validation via `z.string().uuid()`.
- Hard redirect on any pre-existing auth session.
- Cookie validation via `guestOrderCookieName(orderId)` from the
  frozen `lib/api/guest-auth.ts`.
- Service-client read (the `orderer_id IS NULL` check requires
  bypassing RLS).
- Three-fold rejection logic: order missing OR token mismatch OR
  `orderer_id !== null`.
- `signInAnonymously()` → PATCH → openPanel → `router.replace('/')`
  chain in `useEffect`.
- Spinner DOM size 24×24px, centered, full viewport height.

## Testid coverage

| Catalog ID | testid | Element |
|---|---|---|
| GUEST-ENTRY-LOAD | (transient — no DOM at this stage) | n/a |
| GUEST-ENTRY-TOKEN-INVALID | (transient — `redirect()` returns no DOM) | n/a |
| GUEST-ENTRY-ANON-SIGNIN | `guest-panel-opener` | `<main>` root (renders during all sub-states of the bootstrap chain) |
| GUEST-ENTRY-BOOTSTRAP-SPINNER | `guest-bootstrap-spinner` | rotating `<div>` |

## A11y

- `role="status"` on the spinner — announces transient state.
- `aria-label="Opening your order…"` provides a meaningful label
  even though the visual is just a circle.
- `prefers-reduced-motion: reduce` automatically disables Tailwind's
  `animate-spin` (the global CSS gate from S03's `globals.css`).

## Error.tsx

**No colocated `app/order/[orderId]/error.tsx`.** Per `02-routes.md
§4`, this is a transient route; failures fall through to the global
S03 boundary. (In practice, every "failure" is already a silent
`redirect('/')` from page.tsx.)
