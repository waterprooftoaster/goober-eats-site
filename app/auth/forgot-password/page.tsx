/**
 * @file page.tsx
 * @description Forgot-password landing page; renders the email-input form.
 *   Called by: Next.js routing (/auth/forgot-password)
 * @dependencies app/auth/forgot-password/forgot-form.tsx
 */

import { ForgotPasswordForm } from './forgot-form'

/**
 * Renders the forgot-password page.
 * @returns The forgot-password form
 * @called-by Next.js routing (/auth/forgot-password)
 */
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
