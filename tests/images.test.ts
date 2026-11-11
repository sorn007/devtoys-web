import { describe, expect, it } from 'vitest'
import { applyToPixel, applyToPixels, CVD_MATRICES, severityMatrix } from '@/tools/colorblind'
import { assertImageWithinLimits } from '@/tools/base64image'
import { createQrMatrix, hexToRgb, renderQrToPixels } from '@/tools/qr'
import { decodeQrPixels } from '@/tools/qrdecode'
import { clampQuality, CONVERT_FORMATS, mimeFor } from '@/tools/imgconvert'

describe('colour-blind matrices', () => {
  it('keeps every full-severity matrix conserving overall luminance-ish balance', () => {
    // Each row of a CVD matrix should sum to ~1 so overall brightness is preserved.
    for (const [type, m] of Object.entries(CVD_MATRICES)) {
      for (let row = 0; row < 3; row++) {
        const sum = m[row * 3]! + m[row * 3 + 1]! + m[row * 3 + 2]!
        expect(sum).toBeGreaterThan(0.85)
        expect(sum).toBeLessThan(1.15)
      }
      expect(m).toHaveLength(9)
      void type
    }
  })

  it('returns the identity at severity 0 and the full matrix at 1', () => {
    expect(severityMatrix('deutan', 0)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
    const full = severityMatrix('deutan', 1)
    full.forEach((v, i) => expect(v).toBeCloseTo(CVD_MATRICES.deutan[i]!, 6))
    const half = severityMatrix('deutan', 0.5)
    expect(half[0]).toBeCloseTo((1 + CVD_MATRICES.deutan[0]!) / 2, 6)
  })

  it('clamps severity outside 0…1', () => {
    const clampedHigh = severityMatrix('protan', 2)
    clampedHigh.forEach((v, i) => expect(v).toBeCloseTo(CVD_MATRICES.protan[i]!, 6))
    expect(severityMatrix('protan', -1)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
  })

  it('maps known pixels to expected values (protan red attenuation)', () => {
    const m = severityMatrix('protan', 1)
    const [r, g, b] = applyToPixel(m, 255, 0, 0)
    // For a red-blind simulation pure red collapses to a dim, desaturated value:
    // every channel lands far below 255 and the pixel stays clamped to bytes.
    expect(r).toBeLessThan(100)
    expect(g).toBeLessThan(100)
    expect(b).toBeLessThanOrEqual(0)
    expect(r).toBeGreaterThanOrEqual(0)
    const achromat = applyToPixel(severityMatrix('achromat', 1), 255, 0, 0)
    expect(achromat[0]).toBe(achromat[1])
    expect(achromat[1]).toBe(achromat[2])
  })

  it('leaves grey pixels grey under every simulation', () => {
    for (const type of Object.keys(CVD_MATRICES)) {
      const [r, g, b] = applyToPixel(severityMatrix(type as keyof typeof CVD_MATRICES, 1), 128, 128, 128)
      expect(Math.abs(r - g)).toBeLessThanOrEqual(2)
      expect(Math.abs(g - b)).toBeLessThanOrEqual(2)
    }
  })

  it('transforms pixel buffers in place, preserving alpha', () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 200, 0, 255, 0, 100])
    applyToPixels(pixels, severityMatrix('achromat', 1))
    expect(pixels[3]).toBe(200)
    expect(pixels[7]).toBe(100)
    expect(pixels[0]).toBe(pixels[1])
  })
})

describe('image caps', () => {
  it('rejects oversized images before any decode work', () => {
    expect(() => assertImageWithinLimits(13_000, 100)).toThrow(/side is capped/i)
    expect(() => assertImageWithinLimits(7_000, 7_000)).toThrow(/pixels/i) // 49M > 40M
    expect(() => assertImageWithinLimits(6_000, 6_000)).not.toThrow() // 36M ≤ 40M
  })
})

describe('QR round-trip (real, in Node)', () => {
  it('generates a matrix and decodes it back to the original text', async () => {
    const text = 'https://devtoys-inspired.example/qr?round=trip&n=42'
    const matrix = await createQrMatrix(text, 'M')
    expect(matrix.size).toBeGreaterThan(20)
    const pixels = renderQrToPixels(matrix, { scale: 8, margin: 4 })
    expect(pixels.width).toBe((matrix.size + 8) * 8)
    const decoded = await decodeQrPixels(pixels.data, pixels.width, pixels.height)
    expect(decoded).toBe(text)
  })

  it('round-trips at every error-correction level', async () => {
    for (const ec of ['L', 'M', 'Q', 'H'] as const) {
      const matrix = await createQrMatrix('EC level check', ec)
      const pixels = renderQrToPixels(matrix, { scale: 8 })
      expect(await decodeQrPixels(pixels.data, pixels.width, pixels.height)).toBe('EC level check')
    }
  })

  it('round-trips unicode text', async () => {
    const text = 'héllo 🙂 — ünïcode'
    const pixels = renderQrToPixels(await createQrMatrix(text, 'M'), { scale: 8 })
    expect(await decodeQrPixels(pixels.data, pixels.width, pixels.height)).toBe(text)
  })

  it('round-trips Thai and emoji text', async () => {
    const text = 'สวัสดี QR 😀'
    const pixels = renderQrToPixels(await createQrMatrix(text, 'M'), { scale: 8 })
    expect(await decodeQrPixels(pixels.data, pixels.width, pixels.height)).toBe(text)
  })

  it('returns null for a blank image instead of pretending', async () => {
    const blank = renderQrToPixels(await createQrMatrix('x', 'M'), { scale: 8 })
    // Overwrite everything to white: no QR remains.
    blank.data.fill(255)
    expect(await decodeQrPixels(blank.data, blank.width, blank.height)).toBeNull()
  })

  it('enforces its own input cap and rejects bad colours', async () => {
    await expect(createQrMatrix('x'.repeat(2500), 'M')).rejects.toThrow(/cap/i)
    await expect(createQrMatrix('', 'M')).rejects.toThrow(/some text/i)
    expect(() => hexToRgb('nope')).toThrow(/#rrggbb/i)
    expect(hexToRgb('#0A0B0C')).toEqual([10, 11, 12])
  })

  it('renders with margin and scale respected', async () => {
    const matrix = await createQrMatrix('dims', 'M')
    const p = renderQrToPixels(matrix, { scale: 4, margin: 6 })
    expect(p.width).toBe((matrix.size + 12) * 4)
    // Corners of the quiet zone must be light.
    expect(p.data[0]).toBe(255)
  })
})

describe('image converter format model', () => {
  it('offers exactly PNG, JPEG and WebP with correct mime types', () => {
    expect(CONVERT_FORMATS.map((f) => f.id)).toEqual(['png', 'jpeg', 'webp'])
    expect(mimeFor('png')).toBe('image/png')
    expect(mimeFor('jpeg')).toBe('image/jpeg')
    expect(mimeFor('webp')).toBe('image/webp')
  })

  it('clamps quality into the documented 0.5–1 band', () => {
    expect(clampQuality(0.1)).toBe(0.5)
    expect(clampQuality(2)).toBe(1)
    expect(clampQuality(Number.NaN)).toBe(0.92)
    expect(clampQuality(0.75)).toBe(0.75)
  })
})
