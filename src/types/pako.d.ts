/**
 * pako@2.1.0 ships types at its package root but its `exports` map points at
 * the ESM bundle without them, so TS resolves an untyped module. Declare the
 * two functions the GZIP fallback actually uses; the shapes come from pako's
 * published API (gzip/inflate take Uint8Array and return Uint8Array).
 */
declare module 'pako' {
  export function gzip(data: Uint8Array): Uint8Array
  export function inflate(data: Uint8Array): Uint8Array
}
