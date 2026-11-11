/**
 * Base64 ↔ image. File → data URL and back, with decoded-dimension and pixel
 * caps enforced BEFORE a large image is decoded into memory, and every object
 * URL created here tracked so the component can revoke them on unmount.
 */

import { IMAGE_MAX_DIMENSION, IMAGE_MAX_PIXELS } from '@/lib/limits'
import { base64ToBytes, bytesToBase64 } from '@/lib/base64'

export type ImageFacts = {
  mime: string
  width: number
  height: number
  pixels: number
  base64Chars: number
  approxBytes: number
}

export type DataUrlParse =
  | { ok: true; mime: string; bytes: Uint8Array }
  | { ok: false; error: string }

/** Parses a data URL strictly; rejects anything that is not `data:<mime>;base64,<payload>`. */
export function parseDataUrl(input: string): DataUrlParse {
  const s = input.trim()
  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]*)$/i.exec(s)
  if (!match) {
    if (!s.startsWith('data:')) return { ok: false, error: 'Not a data URL (expected "data:<mime>;base64,…").' }
    if (!/;base64,/.test(s)) return { ok: false, error: 'Only base64 data URLs are supported.' }
    return { ok: false, error: 'Malformed data URL: expected "data:<mime>;base64,<payload>".' }
  }
  const [, mime, payloadRaw] = match
  const payload = payloadRaw!.replace(/\s+/g, '')
  try {
    return { ok: true, mime: mime!, bytes: base64ToBytes(payload) }
  } catch {
    return { ok: false, error: 'The base64 payload is not valid base64.' }
  }
}

/** Enforces the decoded-size caps; throws before the bitmap is ever requested. */
export function assertImageWithinLimits(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Could not determine the image dimensions.')
  }
  if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) {
    throw new Error(
      `Image is ${width}×${height}px; each side is capped at ${IMAGE_MAX_DIMENSION.toLocaleString()}px to bound decoded memory.`,
    )
  }
  const pixels = width * height
  if (pixels > IMAGE_MAX_PIXELS) {
    throw new Error(
      `Image is ${width.toLocaleString()}×${height.toLocaleString()} (${pixels.toLocaleString()} pixels); the cap is ${IMAGE_MAX_PIXELS.toLocaleString()} pixels.`,
    )
  }
}

/** Reads dimensions without keeping a decoded copy alive. */
export function probeImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('The browser could not decode this image.'))
    img.src = url
  })
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`
}

export function describeImage(mime: string, bytes: Uint8Array, width: number, height: number): ImageFacts {
  return {
    mime,
    width,
    height,
    pixels: width * height,
    base64Chars: Math.ceil((bytes.byteLength * 4) / 3),
    approxBytes: bytes.byteLength,
  }
}
