'use client'

/**
 * @file name-section.tsx
 * @description Inline name-edit row for the /account modal. Mirrors the school
 *   inline-edit UX from swiper-section.tsx — idle state shows current name +
 *   ghost "Change" button; editing state shows a pre-filled Input with Save/Cancel.
 *   Calls PATCH /api/profile with { full_name } on save.
 *   Called by: components/account-panel.tsx
 * @dependencies components/ui/input, components/ui/button
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface NameSectionProps {
  initialName: string | null
}

/**
 * Inline-edit component for the user's display name. Optimistically updates
 * the displayed name on save success; refreshes the router to sync SSR state.
 * @param initialName - The user's current full_name, or null if unset
 * @returns Name display row with Change/Save/Cancel controls
 * @called-by components/account-panel.tsx
 */
export function NameSection({ initialName }: NameSectionProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState(initialName ?? '')
  const [displayName, setDisplayName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState(false)

  async function handleSave() {
    const trimmed = inputValue.trim()
    if (!trimmed) {
      setError('Name cannot be empty.')
      return
    }
    if (trimmed.length > 100) {
      setError('Name must be 100 characters or fewer.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: trimmed }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Failed to save name.')
        return
      }
      setDisplayName(trimmed)
      setEditing(false)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 3000)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setInputValue(displayName ?? '')
    setEditing(false)
    setError(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Name</p>
      {savedMsg && (
        <p role="status" className="text-sm text-foreground/80">
          Saved.
        </p>
      )}
      {!editing ? (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{displayName ?? '—'}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setEditing(true); setSavedMsg(false) }}
            className="-ml-2"
          >
            Change
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Your name"
            maxLength={100}
            autoFocus
            aria-invalid={error !== null ? true : undefined}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            size="default"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="default"
            onClick={handleCancel}
          >
            Cancel
          </Button>
        </div>
      )}
      {editing && error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
