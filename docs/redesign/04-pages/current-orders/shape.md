# `/current-orders` — Shape

> Page 4 of Session 04. Feature IDs: `ORD-CURRENT-LOAD`, `ORD-CURRENT-LIST`,
> `ORD-CURRENT-EMPTY`, `ORD-CURRENT-STATUS-BADGE`.

## Job

The user has paid (or accepted, as a swiper) and is waiting for the
food. This page is where they live for the next ten minutes — chatting
with the other side, watching the status update in realtime. Nothing
else competes for attention.

## Direction (per `.impeccable.md`)

- **Asymmetric column** — `max-w-3xl` left rail, single-column on
  mobile. No two-column hack: chat is the focus.
- **Tinted cards, no shadows.** Each order is an `<article>` with a
  `bg-card` background + soft border. No card-inside-card.
- **One status badge variant per order status** — neutral pill for
  open, lime-tinted for in_progress, muted for completed, destructive
  for cancelled. The lime never appears as fill, only as a 15%
  background tint to keep the accent rare.
- **Headline carries the restaurant name first**, short order id
  second (de-emphasized). The information hierarchy says "you're
  watching THIS order at THIS place."

## State branches

| Branch | Render |
|---|---|
| `loading` | Server-rendered initial fetch — Next.js handles via global loading.tsx. |
| `populated` | Per-order `<article>` cards with embedded `<ChatView>`. |
| `empty` | Tinted Surface "No active orders." with testid `current-orders-empty-state`. |
| status `open` | Badge "Open" — secondary tone. |
| status `in_progress` | Badge "In progress" — primary/15% tint. |
| status `completed` | Badge "Completed" — muted. ChatView swaps to `<OrderCompletedView>` automatically. |
| status `cancelled` | Badge "Cancelled" — destructive/10% tint. |

## Data fix

The S03 query joined `eateries(name)` — that table no longer exists per
CLAUDE.md domain model. Switching to `select('id, status, restaurant_name, created_at')`
which is the new column. Filter still
`status IN ('open','in_progress','completed')` plus
`(orderer_id=user OR swiper_id=user)` so swipers also see their
in-progress claimed orders here (catalog `auth_branches` includes both
roles).

## Testids

- `current-orders-page` — `<main>` root
- `current-orders-list` — list container
- `current-orders-empty-state` — empty Surface
- `current-orders-status-badge` — per-card pill (appears once per order)

## Errors

- `app/current-orders/error.tsx` — boundary for query/realtime failures
  beyond what ChatView handles inline.
