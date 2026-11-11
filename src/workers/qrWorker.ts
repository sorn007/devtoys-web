/// <reference lib="webworker" />
/**
 * Dedicated worker for the QR tool: generation (qrcode, pure matrix form) and
 * decoding of an uploaded image (jsqr over decoded pixels). Both libraries are
 * dynamically imported inside this tool's chunk graph only.
 */
import { serve, str } from './protocol'
import { assertImageWithinLimits } from '@/tools/base64image'
import { createQrMatrix, renderQrToPixels, type EcLevel } from '@/tools/qr'

serve(async (kind, payload) => {
  switch (kind) {
    case 'qr-create': {
      const matrix = await createQrMatrix(str(payload.text), (str(payload.ec) || 'M') as EcLevel)
      const pixels = renderQrToPixels(matrix, {
        scale: Number(payload.scale ?? 6),
        margin: Number(payload.margin ?? 4),
        dark: str(payload.dark) || undefined,
        light: str(payload.light) || undefined,
      })
      // Encode to PNG in the worker; no DOM canvas involved.
      const off = new OffscreenCanvas(pixels.width, pixels.height)
      const ctx = off.getContext('2d')!
      ctx.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0)
      const blob = await off.convertToBlob({ type: 'image/png' })
      return { blob: new Uint8Array(await blob.arrayBuffer()), mime: 'image/png', size: matrix.size }
    }
    case 'qr-decode': {
      // jsQR is imported ONLY here, so this chunk is fetched on first decode —
      // the generate path above never loads it.
      const { decodeQrPixels } = await import('@/tools/qrdecode')
      const copy = new Uint8Array(payload.data as Uint8Array)
      const bitmap = await createImageBitmap(new Blob([copy as unknown as BlobPart]))
      assertImageWithinLimits(bitmap.width, bitmap.height)
      const off = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = off.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()
      const image = ctx.getImageData(0, 0, off.width, off.height)
      const text = await decodeQrPixels(image.data, image.width, image.height)
      return { text }
    }
    default:
      throw new Error(`Unknown job kind: ${kind}`)
  }
})
