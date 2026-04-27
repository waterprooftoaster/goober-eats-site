/**
 * @file sanitize-error-message.ts
 * @description Strips file paths, line numbers, internal IPs, and stack-trace
 *   fragments from an error message before display so internal details don't
 *   leak to users via the colocated error.tsx boundaries.
 *   Called by: app/swiper/orders/error.tsx, app/stripe/onboard/complete/error.tsx
 *   (and any future colocated error boundary).
 * @dependencies (none)
 */

/**
 * Returns a one-line, user-safe error message: keeps the first line of the
 * input, strips `at <frame>` stack lines, `(file:line:col)` inline refs,
 * absolute file-system paths, and IP:port fragments.
 * @param message - The raw error message
 * @param fallback - Message to return when input is empty or fully stripped
 * @returns A sanitized one-liner safe to display in the UI
 * @called-by colocated error.tsx boundaries under app/
 */
export function sanitizeErrorMessage(message: string, fallback: string): string {
  if (!message) return fallback
  const firstLine = message.split('\n')[0] ?? ''
  const stripped = firstLine
    .replace(/\s*at\s.*$/g, '')
    .replace(/\s*\(.*?:\d+:\d+\).*$/g, '')
    .replace(/\/[^\s]+\.(?:ts|tsx|js|jsx|mjs|cjs)/g, '[file]')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}:\d+[^\s]*/g, '[internal]')
    .trim()
  return stripped || fallback
}
