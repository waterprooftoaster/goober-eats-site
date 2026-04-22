/**
 * @file upload.ts
 * @description Types for the per-file upload state used by ScreenshotUploader and OrderNewForm.
 *   Called by: components/order/screenshot-uploader.tsx, app/order/new/order-new-form.tsx
 */

export type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

export interface UploadFile {
  /** Assigned at selection time via crypto.randomUUID() to avoid File.name collisions. */
  key: string
  file: File
  status: UploadStatus
  /** Public URL; set after a successful upload, null otherwise. */
  url: string | null
  error: string | null
}
