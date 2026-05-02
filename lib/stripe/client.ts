/**
 * @file client.ts
 * @description Server-only re-export of the Stripe SDK singleton. Routes and other
 *   server-rendered code should import from here so the build catches accidental
 *   client-side imports; non-server-rendered scripts (tsx) must import from `./sdk`
 *   directly because `server-only` throws under any resolver that doesn't set the
 *   `react-server` condition.
 *   Called by: lib/stripe/connect.ts, lib/stripe/transfer.ts, app/api/stripe/webhooks/route.ts
 * @dependencies lib/stripe/sdk.ts
 */

import 'server-only'

export { getStripe } from './sdk'
