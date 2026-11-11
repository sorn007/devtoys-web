/**
 * xmllint-wasm@5.3.0 ships no types for its browser ESM entry
 * (dist/index-browser.mjs) — its package "main"/types point at the Node build,
 * which must never be bundled here (it requires fs). Declare the browser API
 * we use; shapes from the package's own index-browser.d.ts.
 */
declare module 'xmllint-wasm/index-browser.mjs' {
  export interface XsdError {
    rawMessage: string
    message: string
    loc: { fileName: string; lineNumber: number } | null
  }
  export interface ValidationResult {
    valid: boolean
    errors: XsdError[]
    rawOutput: string
    normalized: string
  }
  export function validateXML(options: {
    xml: { fileName?: string; contents: string }[]
    schema: { fileName?: string; contents: string }[]
    preload?: { fileName?: string; contents: string }[]
    initialMemoryPages?: number
    maxMemoryPages?: number
  }): Promise<ValidationResult>
  export const memoryPages: { MiB: number; GiB: number; defaultInitialMemoryPages: number; defaultMaxMemoryPages: number; max: number }
}
