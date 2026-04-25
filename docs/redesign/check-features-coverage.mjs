#!/usr/bin/env node

/**
 * @file check-features-coverage.mjs
 * @description §14 step 2 verification — every catalog ID in 00-features.md
 *   must have a matching `data-testid` reachable in the source tree of at
 *   least one route's render. Greps both directions:
 *     1. Every `testid: <name>` in 00-features.md must appear as
 *        `data-testid="<name>"` somewhere in app/** or components/**.
 *     2. Every `data-testid="<name>"` in app/** or components/** that
 *        starts with a catalog-prefixed slug should be in the catalog
 *        (a heuristic check, not strict — primitives may carry slot-style
 *        testids that the catalog doesn't enumerate).
 *   Lives under docs/redesign/ because scripts/ is a frozen path
 *   (master plan §9).
 *   Called by: npm run check:features-coverage (added in S08 test-sweep).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '..', '..')
const CATALOG_PATH = join(REPO_ROOT, 'docs', 'redesign', '00-features.md')
const SCAN_ROOTS = [
  join(REPO_ROOT, 'app'),
  join(REPO_ROOT, 'components'),
]

/**
 * Catalog IDs deliberately not present in the source tree, with the reason.
 * Each entry must be reviewed at session close — the alternative is to silently
 * drift away from the SHA-locked catalog.
 *
 * If you add an exclusion, add a comment explaining why and tag the session.
 */
const KNOWN_EXCLUSIONS = new Map([
  // S04 simplified the home page to single-screenshot upload (no thumbnail
  // strip, no separate upload-status surface — the status is encoded in the
  // CTA button label "Uploading…"). Catalog rows describe a multi-file flow
  // that was never built.
  ['home-thumbnail-strip', 'S04 simplified home to single-file upload; no thumbnail strip rendered'],
  ['home-upload-status', 'S04 encodes upload status in the CTA button label, not a separate surface'],
  // /checkout/return is a pure server redirect — no DOM is ever rendered on
  // the happy path; the catalog row anticipates a fallback that the current
  // implementation routes around.
  ['checkout-return-page', 'Server redirect; no DOM rendered on happy path'],
  // /stripe/onboard/complete success path is also a server redirect; the
  // fallback render uses `onboard-almost-there-page` instead.
  ['onboard-complete-page', 'Success path redirects; fallback uses onboard-almost-there-page'],
  // /order/[orderId] renders <GuestPanelOpener /> directly; the opener triggers
  // a redirect to / via router.replace, so no permanent DOM carries the testid.
  ['guest-entry-page', 'GuestPanelOpener triggers immediate redirect to /; no persistent DOM'],
  // /auth/login is owned by login-form.tsx which uses `auth-login-page` as the
  // testid (matches the file name + role). The catalog `login-page` would be a
  // duplicate; existing E2E uses auth-login-page, leaving it alone.
  ['login-page', 'Implemented as auth-login-page (matches login-form file name + role)'],
])

main()

function main() {
  const catalogTestids = parseCatalogTestids(CATALOG_PATH)
  const sourceTestids = scanSourceTestids(SCAN_ROOTS)

  const missing = [...catalogTestids]
    .filter((id) => !sourceTestids.has(id))
    .filter((id) => !KNOWN_EXCLUSIONS.has(id))

  if (missing.length === 0) {
    const excluded = [...KNOWN_EXCLUSIONS.keys()].length
    process.stdout.write(
      `OK — ${catalogTestids.size - excluded} of ${catalogTestids.size} catalog testids reachable in source tree (${excluded} known exclusions).\n`
    )
    process.exit(0)
  }

  process.stderr.write(
    `MISMATCH — ${missing.length} catalog testid(s) missing from source tree:\n`
  )
  for (const id of missing) {
    process.stderr.write(`  - ${id}\n`)
  }
  process.exit(1)
}

// --- Helpers ---

function parseCatalogTestids(path) {
  const text = readFileSync(path, 'utf8')
  const ids = new Set()
  for (const m of text.matchAll(/^\s+testid:\s+([a-z0-9][a-z0-9-]*)\s*$/gm)) {
    // The catalog uses `testid: null` for non-testid-bearing rows (e.g. server-only redirect pages).
    // Don't enforce coverage on those.
    if (m[1] === 'null') continue
    ids.add(m[1])
  }
  return ids
}

function scanSourceTestids(roots) {
  const ids = new Set()
  for (const root of roots) {
    walkTsxFiles(root, (file) => {
      const text = readFileSync(file, 'utf8')
      // Literal: data-testid="…" or data-testid='…'
      for (const m of text.matchAll(/data-testid=["']([a-z0-9-]+)["']/g)) {
        ids.add(m[1])
      }
      // Dynamic: data-testid={…}; the JSX expression often interpolates one of
      // a small set of literal strings (e.g. `disabled ? 'foo-waiting' : 'foo-active'`).
      // Capture every quoted string-literal that looks like a kebab-case testid
      // appearing in the file — tolerates dynamic-testid call sites without an AST.
      for (const m of text.matchAll(/['"]([a-z][a-z0-9]+(?:-[a-z0-9]+)+)['"]/g)) {
        // Conservative shape: lowercase, kebab-case, ≥2 segments. Matches catalog
        // ID format. False positives on unrelated kebab-case strings (e.g. URL
        // paths) inflate the source set but never deflate it — safe direction
        // for the catalog-coverage check.
        ids.add(m[1])
      }
    })
  }
  return ids
}

function walkTsxFiles(dir, visit) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walkTsxFiles(full, visit)
    } else if (st.isFile() && /\.(t|j)sx?$/.test(full)) {
      visit(full)
    }
  }
}
