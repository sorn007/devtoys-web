/**
 * XSD validation via xmllint-wasm@5.3.0 (MIT; COPYING copied next to the wasm).
 * Runs ONLY inside the dedicated xsdWorker. The library performs no network or
 * filesystem IO — schema dependencies must be passed in — and the wasm is
 * fetched from /assets/xmllint.wasm (public/, NOT precached; served through the
 * tool-assets CacheFirst runtime cache after the first online use).
 */
import { assertInputSize } from '@/lib/limits'
import { assertNoDtd } from '@/tools/xml'

export const XSD_MAX_CHARS = 500_000

export type XsdResult =
  | { ok: true; valid: boolean; errors: { message: string; line: number | null }[]; raw: string }
  | { ok: false; error: string }

export async function validateAgainstXsd(xml: string, schema: string, preloads: string[] = []): Promise<XsdResult> {
  assertInputSize(xml, 'XML input')
  assertInputSize(schema, 'XSD input')
  if (xml.length > XSD_MAX_CHARS || schema.length > XSD_MAX_CHARS) {
    return { ok: false, error: `XML and XSD are each capped at ${XSD_MAX_CHARS.toLocaleString()} characters.` }
  }
  try {
    assertNoDtd(xml)
    assertNoDtd(schema)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  if (!xml.trim() || !schema.trim()) return { ok: false, error: 'Provide both XML and an XSD schema.' }

  const { validateXML } = await import('xmllint-wasm/index-browser.mjs')
  const result = await validateXML({
    xml: [{ fileName: 'input.xml', contents: xml }],
    schema: [{ fileName: 'schema.xsd', contents: schema }],
    preload: preloads.filter(Boolean).map((contents, i) => ({ fileName: `dep${i}.xsd`, contents })),
    // Memory caps: 16 MiB initial / 32 MiB max wasm linear memory.
    initialMemoryPages: 256,
    maxMemoryPages: 512,
  })
  return {
    ok: true,
    valid: result.valid,
    errors: (result.errors ?? []).slice(0, 50).map((e) => ({
      message: e.message,
      line: e.loc?.lineNumber ?? null,
    })),
    raw: result.rawOutput.slice(0, 20_000),
  }
}
