# `/current-orders` — Craft

## Anatomy

```
<main data-testid="current-orders-page" max-w-3xl mx-auto py-8/12>
  <header><h1>Current orders.</h1><p muted /></header>
  <CurrentOrdersList orders currentUserId />
</main>
```

`CurrentOrdersList`:
```
{orders.length === 0
  ? <Surface tone="subtle" padding="lg"
             data-testid="current-orders-empty-state">
      <p>No active orders.</p>
      <p muted>When you place an order or accept one, it'll show up here.</p>
    </Surface>
  : <div data-testid="current-orders-list" flex-col gap-4>
      {orders.map(o => (
        <article rounded-2xl border bg-card>
          <header border-b>
            <span font-semibold>{restaurantName || 'Order'}</span>
            <span muted>#{id.slice(0, 8)}</span>
            <StatusBadge data-testid="current-orders-status-badge" />
          </header>
          <div h-26rem>
            <ChatView orderId currentUserId orderStatus eateryName
                      onStatusChange={updateOrderStatus} />
          </div>
        </article>
      ))}
    </div>
}
```

## Decisions

- **Server query rewrite (the bug fix)** — the prior `eateries(name)`
  join referenced a deleted table. New select is just
  `id, status, restaurant_name`. Filter
  `status IN ('open','in_progress','completed')` is unchanged but the
  WHERE clause now ORs `orderer_id=user` with `swiper_id=user` so
  swipers see their accepted orders here too (per catalog
  `auth_branches: [authed_orderer, authed_swiper]`).
- **No `<Surface>` wrap on each card** — using a plain `<article>` with
  `border-border bg-card` directly. Avoids the surface primitive's
  built-in `data-testid="surface"` colliding across N cards. The tone
  matches Surface visually; the cost is one extra Tailwind class chain.
- **Status badge tints**:
  - `open`: `bg-secondary` (neutral) — waiting state, no urgency.
  - `in_progress`: `bg-primary/15` (lime tint at 15%) — the only place
    on the page that uses primary color, and only as a faint background.
    Stays compliant with the "accent is rare" brand rule.
  - `completed`: `bg-muted` — past state, dialed back.
  - `cancelled`: `bg-destructive/10` — destructive tint.
- **Cancelled state remains rendered even though the server filter
  excludes it** — realtime UPDATE can transition a displayed row to
  cancelled (orderer cancel, swiper account closure). The badge variant
  is exercised when that happens.
- **`updateOrderStatus` callback wired from `useChatPanel()`** — same
  as before, no behavior change. ChatView dispatches status changes
  upstream so any open ChatPanel reflects them.
- **Card height fixed at `h-[26rem]`** — gives the chat thread room
  to breathe without dominating the viewport. Mobile-friendly.

## Behavior preserved

- Server-side auth gate (`redirect('/auth/login')`).
- ChatView still owns its own message fetch + realtime subscription.
- ChatPanelProvider's status callback still fires.
- No new realtime subscription added at this layer (S07 will introduce
  the channel registry).

## Testid coverage

| Catalog ID | testid | Element |
|---|---|---|
| ORD-CURRENT-LOAD | `current-orders-page` | `<main>` |
| ORD-CURRENT-LIST | `current-orders-list` | populated list `<div>` |
| ORD-CURRENT-EMPTY | `current-orders-empty-state` | empty `<Surface>` |
| ORD-CURRENT-STATUS-BADGE | `current-orders-status-badge` | each `<StatusBadge>` |

## error.tsx

`app/current-orders/error.tsx` — Surface with "Retry" + "Go home". Most
realtime-channel and fetch failures are handled inline by ChatView /
useMessages, so this boundary is mostly defensive.
