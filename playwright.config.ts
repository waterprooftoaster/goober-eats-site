/**
 * @file playwright.config.ts
 * @description Playwright E2E configuration. Loads .env.local + .env.test, defines
 *   four projects (setup, chromium, authenticated, live-money). All projects target
 *   the test Supabase + a test-mode Next.js dev server on $TEST_NEXT_PORT (default
 *   3100) — never the dev DB. The `live-money` project is opt-in via RUN_LIVE_MONEY=1
 *   and additionally requires `bash scripts/test-money-up.sh` to have started
 *   `stripe listen` (so the webhook reaches the test dev server).
 *   Called by: npx playwright test
 */

import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

loadEnvFile('.env.local')
loadEnvFile('.env.test')

// Alias TEST_* into the canonical names so existing specs that read
// NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY auto-target the test DB.
// Spec processes inherit this; the dev:test npm script does the same for the dev server.
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY =
  process.env.TEST_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
process.env.SUPABASE_SECRET_KEY = process.env.TEST_SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY

const TEST_NEXT_PORT = process.env.TEST_NEXT_PORT ?? '3100'
const TEST_BASE_URL = `http://localhost:${TEST_NEXT_PORT}`

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: 'list',
  // Cold-compile in dev mode can blow past the default 30s on first-hit routes;
  // 90s gives enough headroom for the auth-form action + onboarding chain.
  timeout: 90000,
  use: {
    baseURL: TEST_BASE_URL,
    screenshot: 'on',
    trace: 'on',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'swiper-setup',
      testMatch: /swiper\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Exclude setup files (handled by their dedicated projects) and the
      // authenticated/authenticated-swiper directories (own projects).
      testIgnore: [/authenticated/, /authenticated-swiper/, /\.setup\.ts$/],
    },
    {
      name: 'authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/orderer.json',
      },
      dependencies: ['setup'],
      testDir: './tests/e2e/authenticated',
      testIgnore: /live-money\.spec\.ts/,
      // Run authenticated tests serially — both seeded users share one test DB.
      workers: 1,
    },
    {
      name: 'live-money',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/orderer.json',
      },
      dependencies: ['setup'],
      testDir: './tests/e2e/authenticated',
      testMatch: /live-money\.spec\.ts/,
      // Opt-in: the project is empty unless RUN_LIVE_MONEY=1
      testIgnore: process.env.RUN_LIVE_MONEY === '1' ? /^$/ : /.*/,
      workers: 1,
      timeout: 60_000,
    },
    {
      name: 'authenticated-swiper',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/swiper.json',
      },
      dependencies: ['swiper-setup'],
      testDir: './tests/e2e/authenticated-swiper',
      workers: 1,
    },
  ],
  webServer: {
    command: 'npm run dev:test',
    url: TEST_BASE_URL,
    reuseExistingServer: true,
    timeout: 60000,
  },
})

// --- Helpers ---

function loadEnvFile(name: string): void {
  try {
    const envFile = readFileSync(resolve(__dirname, name), 'utf-8')
    for (const line of envFile.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // env file not found — assume the relevant vars are set externally
  }
}
