# `/orders` — Craft

## Anatomy

```
<main data-testid="orders-page" max-w-3xl mx-auto py-8/12>
  <header><h1>Order history.</h1><p muted>...</p></header>
  {rows.length === 0
    ? <Surface tone="subtle" padding="lg"
               data-testid="orders-empty-state">No orders yet…</Surface>
    : <ul data-testid="orders-list" flex-col gap-3>
        {rows.map(o =>
          <li>
            <article rounded-2xl border bg-card p-5>
              <div flex justify-between>
                <div>
                  <p font-medium>{restaurantName || 'Order'}</p>
                  <p muted>
                    <span data-testid="orders-role-badge"
                          data-role={'placed'|'fulfilled'}>
                      Placed | Fulfilled
                    </span>
                    · {formatDate(created_at)}
                  </p>
                </div>
                <div text-right>
                  <p font-semibold tabular-nums>${total}</p>
                  <p muted>{STATUS_LABEL[status]}</p>
                </div>
              </div>
            </article>
          </li>
        )}
      </ul>}
</main>
```

## Decisions

- **Query rewrite (the bug fix)** — `eateries!orders_eatery_id_fkey(name)`
  and the `items` column are gone. Replaced with
  `select('id, status, restaurant_name, total_cents, created_at,
  orderer_id, swiper_id')`.
- **Single query with `.or()`** instead of two parallel queries +
  client-side merge. Postgrest already returns sorted by `created_at
  DESC` — no JS sort needed.
- **Role derivation in JS**, not via two-pass query: per row, if
  `orderer_id === user.id` then `role = 'placed'`, else `'fulfilled'`.
- **`tabular-nums` on the total** — keeps the column edge straight
  even with mixed digit widths. Tiny detail but matches the
  bank-statement aesthetic from `.impeccable.md`.
- **Status label as plain text**, not a badge. The role chip is the
  only chip per row; status is metadata, not a state badge.
- **Bonus `data-testid="orders-role-badge"`** added even though the
  catalog doesn't list it — gives E2E a way to assert the merge of
  roles renders correctly. Not a contract bump (no entry in
  `00-features.md`).

## Behavior preserved

- `getAuthenticatedUser()` server-side gate; redirect to /auth/login.
- Newest-first ordering.
- Static list — no realtime subscription.
- No detail navigation, no tap-into.

## Testid coverage

| Catalog ID | testid | Element |
|---|---|---|
| ORD-ORDERS-LOAD | `orders-page` | `<main>` |
| ORD-ORDERS-LIST | `orders-list` | populated `<ul>` |
| ORD-ORDERS-EMPTY | `orders-empty-state` | empty `<Surface>` |
