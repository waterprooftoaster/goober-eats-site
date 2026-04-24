/**
 * @file vitest.config.ts
 * @description Vitest configuration for unit tests: React plugin, jsdom
 *   environment, path aliases, and v8 coverage thresholds on the
 *   payments-critical paths.
 *   Called by: npm run test
 */

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    globals: true,
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Scope the 80% threshold to files this PR touches. Pre-existing
      // 0%-coverage files (stripe/client.ts, stripe/connect.ts,
      // api/orders/route.ts, api/stripe/connect/*) are out of scope for
      // the 12-finding payments-hardening fix and tracked separately.
      include: [
        'lib/pricing.ts',
        'lib/stripe/account-state.ts',
        'lib/stripe/transfer.ts',
        'lib/stripe/webhook-idempotency.ts',
        'lib/orders/**',
        'app/api/stripe/webhooks/**',
        'app/api/stripe/checkout-session/**',
        'app/api/orders/[id]/accept/**',
        'app/api/orders/[id]/status/**',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      // The `server-only` package throws when imported outside a Server
      // Component; in vitest (jsdom) we substitute the react-server stub
      // so modules that `import 'server-only'` can be unit-tested.
      'server-only': resolve(__dirname, 'node_modules/server-only/empty.js'),
    },
  },
})
