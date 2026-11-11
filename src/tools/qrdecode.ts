/**
 * QR DECODING — kept in its own module (and its own chunk) because it pulls
 * `jsqr` (Apache-2.0, ~131 kB), which is deliberately excluded from the PWA
 * precache. Only the decode path ever imports it, so generating a QR code
 * works offline on a fresh install while decoding needs one online visit.
 */

export /** Decodes RGBA pixels via jsQR; returns null when no QR code is found. */ async function decodeQrPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<string | null> {
  const jsQR = (await import('jsqr')).default
  const result = jsQR(data, width, height)
  return result ? result.data : null
}
