#!/usr/bin/env node
/**
 * @file check-features-hash.mjs
 * @description Catalog-lockdown sentinel. Fails if docs/redesign/00-features.md drifts
 *   from the SHA-256 recorded in SESSION_LOG.md without a matching entry in
 *   FEATURES_CHANGELOG.md. Invoked via `npm run lint:features-hash`.
 *   Called by: npm script in package.json
 */

import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

const features = readFileSync('docs/redesign/00-features.md', 'utf8')
const current = createHash('sha256').update(features).digest('hex')
const log = readFileSync('docs/redesign/SESSION_LOG.md', 'utf8')
const match = log.match(/features\.md SHA-256:\s*`?([a-f0-9]{64})`?/i)

if (!match) {
  console.error('No features.md SHA-256 recorded in SESSION_LOG.md yet.')
  console.error(`Current hash: ${current}`)
  console.error('Paste this line into SESSION_LOG.md (under the latest session close entry):')
  console.error(`  - features.md SHA-256: \`${current}\``)
  process.exit(1)
}

const recorded = match[1]
if (current === recorded) {
  process.exit(0)
}

if (!existsSync('docs/redesign/FEATURES_CHANGELOG.md')) {
  console.error(`features.md changed (${recorded} -> ${current}) without docs/redesign/FEATURES_CHANGELOG.md`)
  process.exit(1)
}

const changelog = readFileSync('docs/redesign/FEATURES_CHANGELOG.md', 'utf8')
if (!changelog.includes(current)) {
  console.error(`features.md changed (new hash ${current}) but no matching entry in FEATURES_CHANGELOG.md`)
  process.exit(1)
}

console.log(`features.md hash accepted via FEATURES_CHANGELOG.md: ${current}`)
