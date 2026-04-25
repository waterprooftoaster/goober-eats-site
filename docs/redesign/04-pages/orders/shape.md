# `/orders` — Shape

> Page 5 of Session 04. Feature IDs: `ORD-ORDERS-LOAD`, `ORD-ORDERS-LIST`,
> `ORD-ORDERS-EMPTY`.

## Job

The user's history page. Every order they have ever placed AND every
order they have fulfilled as a swiper, merged into a single newest-first
list. No realtime, no actions — just receipts.

## Direction (per `.impeccable.md`)

- **Receipt-like rows.** Each entry is a tinted card with a
  two-column layout: restaurant + role + date on the left, total +
  status on the right. Tabular-nums on the dollar amount so vertical
  rhythm holds across rows.
- **No icons, no shadows.** The layout reads like a bank statement.
- **Role chip is a tiny secondary pill** — "Placed" or "Fulfilled" —
  stamped above the date. Doesn't compete with the headline.

## Data fix

The S03 query joined `eateries!orders_eatery_id_fkey(name)` and read
`items` (a deleted column). Both are gone per CLAUDE.md. The new
select projects `id, status, restaurant_name, total_cents, created_at,
orderer_id, swiper_id`; role is derived in JS by comparing
`orderer_id` / `swiper_id` to `user.id`.

The WHERE expands from `orderer_id=user` to
`orderer_id=user OR swiper_id=user` so swipers see their fulfilled
orders here too (catalog says "merged orders list").

## State branches

| Branch | Render |
|---|---|
| `loading` | Server-rendered (no per-route loading.tsx in catalog). |
| `populated` | `<ul data-testid="orders-list">` with one `<li>` per order. |
| `empty` | Tinted Surface "No orders yet." with testid `orders-empty-state`. |

## Testids

- `orders-page` — `<main>` root
- `orders-list` — populated `<ul>`
- `orders-empty-state` — empty Surface
- `orders-role-badge` — bonus testid (not in catalog) on the role chip,
  so the merge-of-roles split can be E2E-asserted later

## Out of scope

- No `error.tsx` (per `02-routes.md §4` — falls through to global).
- No tap-into-detail navigation (catalog has no detail route here).
- No realtime updates (catalog says static).
