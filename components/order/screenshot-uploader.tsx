/**
 * @file screenshot-uploader.tsx
 * @description Controlled screenshot uploader — shows thumbnails with remove buttons.
 *   Purely display + validation; no network calls (upload is the form's responsibility).
 *   Called by: app/order/new/order-new-form.tsx
 * @dependencies lib/types/upload.ts
 */

'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { ImageUp } from 'lucide-react'
import type { UploadFile } from '@/lib/types/upload'

const MAX_FILES = 5
const MAX_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic'])

interface ScreenshotUploaderProps {
  files: UploadFile[]
  onChange: (files: UploadFile[]) => void
  disabled?: boolean
}

/**
 * Renders an image upload trigger and a thumbnail grid with per-file remove buttons.
 * Validates size (≤ 10 MB) and MIME type client-side; invalid files get status='error'.
 * @param files - Controlled list of UploadFile entries
 * @param onChange - Called with the new immutable files array on any change
 * @called-by app/order/new/order-new-form.tsx
 */
export function ScreenshotUploader({ files, onChange, disabled }: ScreenshotUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const atLimit = files.length >= MAX_FILES

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return

    const newEntries: UploadFile[] = selected.map((file) => {
      if (file.size > MAX_SIZE_BYTES) {
        return { key: crypto.randomUUID(), file, status: 'error', url: null, error: 'File exceeds 10 MB limit' }
      }
      if (!ALLOWED_MIME.has(file.type)) {
        return { key: crypto.randomUUID(), file, status: 'error', url: null, error: 'File type not supported (use PNG, JPG, WebP, or HEIC)' }
      }
      return { key: crypto.randomUUID(), file, status: 'idle', url: null, error: null }
    })

    const remaining = MAX_FILES - files.length
    onChange([...files, ...newEntries.slice(0, remaining)])
    // Reset so the same file can be re-selected after removal
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleRemove(key: string) {
    onChange(files.filter((f) => f.key !== key))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Upload screenshots"
          disabled={disabled || atLimit}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-800 disabled:pointer-events-none disabled:opacity-40"
        >
          <ImageUp className="h-4 w-4" />
          Add screenshots
        </button>
        {atLimit && (
          <span className="text-xs text-gray-400">Maximum {MAX_FILES} screenshots</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic"
        multiple
        disabled={disabled || atLimit}
        onChange={handleFileChange}
        className="hidden"
      />

      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {files.map((f, i) => (
            <div key={f.key} className="relative rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-50">
              {f.status === 'uploading' && (
                <div className="flex h-full items-center justify-center" role="status" aria-label="Uploading">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                </div>
              )}
              {f.status === 'done' && f.url && (
                <Image src={f.url} alt={`Screenshot ${i + 1}`} fill className="object-cover" />
              )}
              {f.status === 'idle' && (
                <div className="flex h-full items-center justify-center text-xs text-gray-400 p-1 text-center break-all">
                  {f.file.name}
                </div>
              )}
              {f.status === 'error' && (
                <div className="flex h-full items-center justify-center p-2 text-center">
                  <span className="text-xs text-red-600">{f.error}</span>
                </div>
              )}
              <button
                type="button"
                aria-label={`Remove screenshot ${i + 1}`}
                onClick={() => handleRemove(f.key)}
                className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-0.5 leading-none hover:bg-black/80"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
