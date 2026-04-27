'use client'

/**
 * @file account-actions.tsx
 * @description Account actions: View orders link, Sign out, Delete account
 *   (two-step confirm). Restyled against OKLCH-126 + S03 primitives.
 *   Called by: components/account-panel.tsx
 * @dependencies app/auth/actions.ts, components/ui/button
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signOut, deleteAccount } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'

/**
 * Renders the account-modal action set: orders link, sign-out, and a
 * two-step delete-account confirmation dialog.
 * @returns Action controls
 * @called-by components/account-panel.tsx
 */
export function AccountActions() {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignOut() {
    router.back()
    await signOut()
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    router.back()
    const result = await deleteAccount()
    if (result?.error) {
      setError(result.error)
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="subtle" asChild>
        <Link href="/orders">My orders</Link>
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={handleSignOut}
        data-testid="account-signout-button"
      >
        Sign out
      </Button>

      {!confirming ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => { setConfirming(true); setError(null) }}
          data-testid="account-delete-button"
          className="text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          Delete account
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm text-foreground">
            Are you sure? This action cannot be undone.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              size="default"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </Button>
            <Button
              type="button"
              variant="subtle"
              size="default"
              onClick={() => { setConfirming(false); setError(null) }}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
