/**
 * @file vercel.ts
 * @description Vercel project configuration. Replaces vercel.json. Drives the
 *   crons schedule for /api/cron/sweep-stale-orders, which auto-cancels
 *   orders that have been in 'open' or 'in_progress' for more than 24h
 *   (releases the auth hold under manual capture).
 *   Called by: Vercel platform at deploy time.
 * @dependencies @vercel/config
 */

import { type VercelConfig } from '@vercel/config/v1'

export const config: VercelConfig = {
  crons: [
    {
      // Sweep every 15 minutes; orders are eligible at 24h. Per CRON_SECRET
      // header check inside the route, Vercel's cron platform must inject
      // the matching Authorization: Bearer ${CRON_SECRET} header.
      path: '/api/cron/sweep-stale-orders',
      schedule: '*/15 * * * *',
    },
  ],
}

export default config
