'use client'

/**
 * @file account-actions.tsx
 * @description Client component providing Sign Out and Delete Account actions on the account page.
 *   Called by: components/account-panel.tsx
 * @dependencies app/auth/actions.ts
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, deleteAccount } from '@/app/auth/actions'

/**
 * Renders sign-out and delete-account buttons with a two-step confirmation for deletion.
 * @returns Account action controls
 * @called-by components/account-panel.tsx
 */
export function AccountActions() {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleSignOut() {
    router.back()
    await signOut()
  }

  async function handleDelete() {
    setDeleting(true)
    router.back()
    const result = await deleteAccount()
    if (result?.error) {
      setError(result.error)
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => { window.location.href = '/orders' }}
        className="block w-full rounded-md border border-gray-300 px-4 py-2 text-center text-gray-700 hover:bg-gray-50"
      >
        My Orders
      </button>

      <button
        type="button"
        onClick={handleSignOut}
        data-testid="account-signout-button"
        className="w-full rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
      >
        Sign Out
      </button>

      <hr className="border-gray-200" />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          data-testid="account-delete-button"
          className="w-full rounded-md border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50"
        >
          Delete Account
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Are you sure? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Yes, delete'}
            </button>
            <button
              onClick={() => {
                setConfirming(false)
                setError(null)
              }}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
