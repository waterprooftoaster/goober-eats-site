/**
 * @file playwright.config.ts
 * @description Playwright E2E configuration: two projects (unauthenticated chromium, authenticated chromium).
 *   Loads .env.local for Supabase credentials; authenticated project depends on auth.setup.ts.
 *   Called by: npx playwright test
 */

import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local so Supabase credentials are available in test files
try {
  const envFile = readFileSync(resolve(__dirname, '.env.local'), 'utf-8')
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
  // .env.local not found — assume env vars are already set
}

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: 'list',
  // Cold-compile in dev mode can blow past the default 30s on first-hit routes;
  // 90s gives enough headroom for the auth-form action + onboarding chain.
  timeout: 90000,
  use: {
    baseURL: BASE_URL,
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
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
      testDir: './tests/e2e/authenticated',
      // Run authenticated tests serially — all files share a single test user,
      // so parallel execution causes state interference between test files.
      workers: 1,
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
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 30000,
  },
})
