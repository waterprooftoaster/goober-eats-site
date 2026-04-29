/**
 * @file normalize.ts
 * @description Client-side image normalizer for cart screenshots and completion
 *   photos. Resizes the long edge to TARGET_LONG_EDGE (downscaling OR upscaling)
 *   and re-encodes as JPEG so storage bytes are uniform regardless of input
 *   size. Aspect ratio is preserved as-is — the preview gives the user
 *   implicit consent to their image's framing before placing the order.
 *   HEIC/HEIF passes through untouched (no browser can decode it via
 *   createImageBitmap).
 *   Called by: components/home-upload.tsx, components/chat/completion-banner.tsx
 * @dependencies (browser globals) createImageBitmap, HTMLCanvasElement
 */

const TARGET_LONG_EDGE = 1500
const JPEG_QUALITY = 0.85

export type NormalizeResult =
  | { ok: true; file: File }
  | { ok: false; reason: 'decode-failed' }

/**
 * Normalizes an image File: resizes the long edge to TARGET_LONG_EDGE pixels
 * (down OR up), re-encoding as JPEG. Preserves aspect ratio.
 * @param file - The user-selected image File
 * @returns ok=true with a JPEG File on success, ok=false with reason
 *   'decode-failed' on a corrupt or undecodable image
 * @called-by components/home-upload.tsx (handlePlaceOrder),
 *   components/chat/completion-banner.tsx (handleFileChange)
 */
export async function normalizeImage(file: File): Promise<NormalizeResult> {
  // Non-images: untouched. Server-side validation catches bad uploads.
  if (!file.type.startsWith('image/')) return { ok: true, file }
  // HEIC/HEIF can't be decoded by createImageBitmap in any current browser,
  // so we can't resize here. Pass through.
  if (file.type === 'image/heic' || file.type === 'image/heif') {
    return { ok: true, file }
  }

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
    const { targetW, targetH } = computeTargetDims(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) return { ok: false, reason: 'decode-failed' }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)

    const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY)
    if (!blob) return { ok: false, reason: 'decode-failed' }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
    return { ok: true, file: new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }) }
  } catch {
    return { ok: false, reason: 'decode-failed' }
  } finally {
    bitmap?.close()
  }
}

// --- Helpers ---

/**
 * Computes target canvas dimensions so the long edge equals TARGET_LONG_EDGE.
 * Preserves aspect ratio. Bigger images shrink, smaller images upscale.
 * @param srcW - Source image width
 * @param srcH - Source image height
 * @returns Object with targetW and targetH (rounded to integers)
 * @called-by normalizeImage
 */
function computeTargetDims(srcW: number, srcH: number): { targetW: number; targetH: number } {
  const longEdge = Math.max(srcW, srcH)
  const scale = TARGET_LONG_EDGE / longEdge
  return {
    targetW: Math.round(srcW * scale),
    targetH: Math.round(srcH * scale),
  }
}

/**
 * Promise wrapper around HTMLCanvasElement.toBlob.
 * @param canvas - Canvas element holding the drawn image
 * @param mime - Output MIME type
 * @param quality - Encoder quality (0..1)
 * @returns The encoded Blob, or null if the encoder failed
 * @called-by normalizeImage
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality)
  })
}
