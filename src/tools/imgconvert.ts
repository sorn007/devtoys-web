/**
 * Image conversion formats. Actual encode/decode happens in a dedicated worker
 * via createImageBitmap + OffscreenCanvas.convertToBlob, so what lives here is
 * the honest capability model: formats are claimed only when the running
 * browser can actually decode/encode them, checked at runtime — never from a
 * hard-coded list of marketing names.
 */

export type ImageFormat = 'png' | 'jpeg' | 'webp'

export const CONVERT_FORMATS: readonly { id: ImageFormat; mime: string; lossy: boolean; label: string }[] = [
  { id: 'png', mime: 'image/png', lossy: false, label: 'PNG (lossless)' },
  { id: 'jpeg', mime: 'image/jpeg', lossy: true, label: 'JPEG (lossy)' },
  { id: 'webp', mime: 'image/webp', lossy: true, label: 'WebP (lossy)' },
] as const

export function mimeFor(format: ImageFormat): string {
  return CONVERT_FORMATS.find((f) => f.id === format)!.mime
}

/**
 * True only if this browser can actually ENCODE the format: we ask it to
 * encode a 1×1 pixel and check the blob's type. A mime the browser cannot
 * produce is reported as unsupported instead of pretending.
 */
export async function canEncode(format: ImageFormat): Promise<boolean> {
  if (typeof OffscreenCanvas === 'undefined') return false
  try {
    const canvas = new OffscreenCanvas(1, 1)
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    const blob = await canvas.convertToBlob({ type: mimeFor(format) })
    return blob.type === mimeFor(format)
  } catch {
    return false
  }
}

/** Quality is only meaningful for lossy targets; clamped to 0.5–1 in the UI. */
export function clampQuality(quality: number): number {
  if (!Number.isFinite(quality)) return 0.92
  return Math.max(0.5, Math.min(1, quality))
}

/**
 * Honest decode-capability note: decode support is whatever the browser's
 * image decoder accepts (Safari decodes no WebP-before-16 caveats, AVIF/HEIC
 * vary). The UI reports the actual decode result rather than a promised list.
 */
export const DECODE_DISCLOSURE =
  'Decoding accepts whatever this browser can decode (PNG, JPEG, GIF, WebP and usually AVIF on Chrome/Edge; ' +
  'HEIC is not decodable in browsers today, and TIFF is not). Encoding is offered only for PNG, JPEG and WebP, ' +
  'verified against this browser at runtime.'
