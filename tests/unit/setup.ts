/**
 * @file setup.ts
 * @description Vitest global setup that loads jest-dom custom matchers for all unit tests.
 *   Called by: vitest.config.ts (setupFiles)
 */

import '@testing-library/jest-dom'
