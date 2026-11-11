/**
 * QR GENERATION only — deliberately in a module with no reference (static or
 * dynamic) to `jsqr`, so the precached generate path never pulls the 131 kB
 * decode library. Decoding lives in `src/tools/qrdecode.ts`.
 *
 * `qrcode` (MIT) is used in its PURE form (`QRCode.create` → module matrix),
 * so the same code runs in Node tests and in a worker; rendering to pixels is
 * our own function below.
 */

export const QR_MAX_INPUT_CHARS = 2_000

export type QrMatrix = {
  size: number
  /** Row-major booleans: true = dark module. */
  dark: Uint8Array
}

export type EcLevel = 'L' | 'M' | 'Q' | 'H'

export async function createQrMatrix(text: string, ec: EcLevel = 'M'): Promise<QrMatrix> {
  if (!text) throw new Error('Enter some text to encode.')
  if (text.length > QR_MAX_INPUT_CHARS) {
    throw new Error(`Text is ${text.length.toLocaleString()} characters; the cap is ${QR_MAX_INPUT_CHARS.toLocaleString()}.`)
  }
  const QRCode = await import('qrcode')
  const qr = QRCode.create(text, { errorCorrectionLevel: ec })
  const size = qr.modules.size
  const data = qr.modules.data
  const dark = new Uint8Array(size * size)
  for (let i = 0; i < dark.length; i++) dark[i] = data[i] ? 1 : 0
  return { size, dark }
}

export type RenderOptions = {
  /** Pixel size of each module. */
  scale?: number
  /** Quiet-zone width in modules (spec minimum 4). */
  margin?: number
  dark?: string
  light?: string
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`"${hex}" is not a #rrggbb colour.`)
  const n = Number.parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Renders a matrix to RGBA pixels — pure, so a Node test can feed it to a decoder. */
export function renderQrToPixels(
  matrix: QrMatrix,
  options: RenderOptions = {},
): { data: Uint8ClampedArray; width: number; height: number } {
  const scale = Math.max(1, Math.min(32, Math.floor(options.scale ?? 6)))
  const margin = Math.max(0, Math.min(16, Math.floor(options.margin ?? 4)))
  const dark = hexToRgb(options.dark ?? '#000000')
  const light = hexToRgb(options.light ?? '#ffffff')
  const dim = (matrix.size + margin * 2) * scale
  const data = new Uint8ClampedArray(dim * dim * 4)
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const row = Math.floor(y / scale) - margin
      const col = Math.floor(x / scale) - margin
      const isDark =
        row >= 0 && col >= 0 && row < matrix.size && col < matrix.size && matrix.dark[row * matrix.size + col] === 1
      const [r, g, b] = isDark ? dark : light
      const i = (y * dim + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  return { data, width: dim, height: dim }
}
