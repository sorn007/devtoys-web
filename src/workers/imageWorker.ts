/// <reference lib="webworker" />
/**
 * Dedicated worker for the pixel-image tools (colour-blind simulation, image
 * conversion). The QR tool has its own worker so its libraries never load for
 * these tools. Bitmaps are closed and nothing is retained between jobs.
 */
import { serve, str } from './protocol'
import { assertImageWithinLimits } from '@/tools/base64image'
import { applyToPixels, severityMatrix, type CvdType } from '@/tools/colorblind'
import { clampQuality, mimeFor, type ImageFormat } from '@/tools/imgconvert'

async function bitmapFrom(data: Uint8Array): Promise<ImageBitmap> {
  const copy = new Uint8Array(data) // BitmapSource needs its own buffer
  const bitmap = await createImageBitmap(new Blob([copy as unknown as BlobPart]))
  assertImageWithinLimits(bitmap.width, bitmap.height) // enforced BEFORE pixel work
  return bitmap
}

serve(async (kind, payload) => {
  switch (kind) {
    case 'cvd-simulate': {
      const bitmap = await bitmapFrom(payload.data as Uint8Array)
      const off = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = off.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()
      const image = ctx.getImageData(0, 0, off.width, off.height)
      const matrix = severityMatrix(str(payload.type) as CvdType, Number(payload.severity ?? 1))
      applyToPixels(image.data, matrix)
      ctx.putImageData(image, 0, 0)
      const blob = await off.convertToBlob({ type: 'image/png' })
      return { blob: new Uint8Array(await blob.arrayBuffer()), mime: 'image/png' }
    }
    case 'image-convert': {
      const bitmap = await bitmapFrom(payload.data as Uint8Array)
      const off = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = off.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()
      const format = str(payload.format) as ImageFormat
      const blob = await off.convertToBlob({
        type: mimeFor(format),
        quality: clampQuality(Number(payload.quality ?? 0.92)),
      })
      if (blob.type !== mimeFor(format)) {
        throw new Error(`This browser cannot encode ${format.toUpperCase()} (it produced ${blob.type || 'nothing'}).`)
      }
      return {
        blob: new Uint8Array(await blob.arrayBuffer()),
        mime: blob.type,
        width: off.width,
        height: off.height,
      }
    }
    default:
      throw new Error(`Unknown job kind: ${kind}`)
  }
})
