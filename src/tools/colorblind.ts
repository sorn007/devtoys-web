/**
 * Colour-vision-deficiency simulation matrices (Machado, Oliveira & Fernandes
 * 2009, severity 1.0) plus achromatopsia. The matrices and the pixel transform
 * are pure data/math so they are unit-testable without a canvas; the worker
 * only supplies the pixels.
 */

export type CvdType = 'protan' | 'deutan' | 'tritan' | 'achromat'

export const CVD_TYPES: readonly CvdType[] = ['protan', 'deutan', 'tritan', 'achromat'] as const

export const CVD_LABELS: Record<CvdType, string> = {
  protan: 'Protanopia (red-blind)',
  deutan: 'Deuteranopia (green-blind)',
  tritan: 'Tritanopia (blue-blind)',
  achromat: 'Achromatopsia (monochrome)',
}

/** Row-major 3×3 matrices at full severity. */
export const CVD_MATRICES: Record<CvdType, readonly number[]> = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
  achromat: [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114],
}

const IDENTITY: readonly number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1]

/** Linear interpolation identity→matrix by severity (0…1). */
export function severityMatrix(type: CvdType, severity: number): number[] {
  const s = Math.max(0, Math.min(1, severity))
  const m = CVD_MATRICES[type]!
  return m.map((v, i) => IDENTITY[i]! + (v - IDENTITY[i]!) * s)
}

/** Applies a 3×3 matrix to one RGB triplet, clamped to byte range. */
export function applyToPixel(matrix: readonly number[], r: number, g: number, b: number): [number, number, number] {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return [
    clamp(matrix[0]! * r + matrix[1]! * g + matrix[2]! * b),
    clamp(matrix[3]! * r + matrix[4]! * g + matrix[5]! * b),
    clamp(matrix[6]! * r + matrix[7]! * g + matrix[8]! * b),
  ]
}

/** In-place transform of RGBA pixel data (Uint8ClampedArray from ImageData). */
export function applyToPixels(pixels: Uint8ClampedArray, matrix: readonly number[]): Uint8ClampedArray {
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b] = applyToPixel(matrix, pixels[i]!, pixels[i + 1]!, pixels[i + 2]!)
    pixels[i] = r
    pixels[i + 1] = g
    pixels[i + 2] = b
  }
  return pixels
}
