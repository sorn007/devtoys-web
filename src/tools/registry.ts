import type { Component } from 'vue'

export type ToolCategory = 'Converters' | 'Encoders & Decoders' | 'Formatters' | 'Generators' | 'Graphic' | 'Testers' | 'Text'

export type ToolMeta = {
  id: string
  name: string
  category: ToolCategory
  keywords: string[]
  description: string
  /** Inline SVG path (24x24, stroke-rendered): no icon package, no network. */
  icon: string
  /** Dynamic import: Vite code-splits this into its own lazily-fetched chunk. */
  load: () => Promise<{ default: Component }>
}

/**
 * The single source of truth for what exists. `load` is never called at module
 * scope, so importing the registry is free — a tool's component (and its
 * worker) only materialise when the user opens it.
 */
export const TOOLS: readonly ToolMeta[] = [
  {
    id: 'json',
    name: 'JSON Formatter & Validator',
    category: 'Formatters',
    keywords: ['json', 'format', 'pretty', 'validate', 'minify', 'lint', 'parse'],
    icon: 'M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1',
    description: 'Pretty-print, minify and validate JSON with line/column error locations.',
    load: () => import('@/components/tools/JsonTool.vue'),
  },
  {
    id: 'base64',
    name: 'Base64 Encoder / Decoder',
    category: 'Encoders & Decoders',
    keywords: ['base64', 'encode', 'decode', 'b64', 'url-safe', 'atob', 'btoa'],
    icon: 'M4 9h13l-3-3M4 9l3 3M20 15H7l3 3M20 15l-3-3',
    description: 'UTF-8-safe Base64 encode and decode, standard or URL-safe alphabet.',
    load: () => import('@/components/tools/Base64Tool.vue'),
  },
  {
    id: 'url',
    name: 'URL Encoder / Decoder',
    category: 'Encoders & Decoders',
    keywords: ['url', 'uri', 'encode', 'decode', 'percent', 'query', 'parse', 'escape'],
    icon: 'M10.5 13.5a4 4 0 0 0 5.7.4l2.8-2.8a4 4 0 0 0-5.7-5.7l-1.6 1.6M13.5 10.5a4 4 0 0 0-5.7-.4l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.6-1.6',
    description: 'Percent-encode/decode and split a URL into its parts and query parameters.',
    load: () => import('@/components/tools/UrlTool.vue'),
  },
  {
    id: 'uuid',
    name: 'UUID Generator',
    category: 'Generators',
    keywords: ['uuid', 'guid', 'v4', 'v7', 'id', 'random', 'nil'],
    icon: 'M5 9h16M5 15h16M11 5 9 19M17 5l-2 14',
    description: 'Generate RFC 4122 v4 and sortable v7 UUIDs, and validate existing ones.',
    load: () => import('@/components/tools/UuidTool.vue'),
  },
  {
    id: 'hash',
    name: 'Hash & Checksum',
    category: 'Generators',
    keywords: ['hash', 'sha', 'sha1', 'sha256', 'sha512', 'checksum', 'crc32', 'digest'],
    icon: 'M12 21s7-3.5 7-9V6l-7-3-7 3v6c0 5.5 7 9 7 9zM9.5 12l1.8 1.8L15 10',
    description: 'SHA-1/256/384/512 digests and CRC-32 checksums, hex or Base64.',
    load: () => import('@/components/tools/HashTool.vue'),
  },
  {
    id: 'diff',
    name: 'Text Diff',
    category: 'Text',
    keywords: ['diff', 'compare', 'text', 'merge', 'changes', 'lines'],
    icon: 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 9v1a5 5 0 0 0 5 5h2M17 15v-1a5 5 0 0 0-5-5h-2',
    description: 'Line-by-line comparison of two texts with an aligned, bounded edit script.',
    load: () => import('@/components/tools/DiffTool.vue'),
  },
  {
    id: 'regex',
    name: 'Regex Tester',
    category: 'Testers',
    keywords: ['regex', 'regexp', 'pattern', 'match', 'replace', 'capture', 'groups'],
    icon: 'M5 19h.01M7 6l5 12M12 6 7 18M15 9l3-2M19 14l-3-1',
    description: 'Test patterns with flags, matches, capture groups and live replace preview.',
    load: () => import('@/components/tools/RegexTool.vue'),
  },
  {
    id: 'date',
    name: 'Date Converter',
    category: 'Converters',
    keywords: ['date', 'time', 'unix', 'epoch', 'timestamp', 'iso', 'rfc', 'ticks', 'milliseconds', 'convert'],
    icon: 'M7 3h2v2H7zM15 3h2v2h-2zM7 19h2v2H7zM15 19h2v2h-2zM7 7h10v10H7z',
    description: 'Convert Unix seconds/millis/micros, .NET ticks and ISO dates into every representation, with BigInt precision.',
    load: () => import('@/components/tools/DateTool.vue'),
  },
  {
    id: 'numberbase',
    name: 'Number Base Converter',
    category: 'Converters',
    keywords: ['number', 'base', 'radix', 'binary', 'hex', 'decimal', 'octal', 'bigint', 'twos complement'],
    icon: 'M4 7h16M4 12h10M4 17h13M17 15l3 2-3 2',
    description: "Convert integers between bases 2–36 at arbitrary precision, with 8/16/32/64-bit two's-complement views.",
    load: () => import('@/components/tools/NumberBaseTool.vue'),
  },
  {
    id: 'lorem',
    name: 'Lorem Ipsum Generator',
    category: 'Generators',
    keywords: ['lorem', 'ipsum', 'filler', 'dummy', 'placeholder', 'text', 'generator'],
    icon: 'M5 5h14M5 10h14M5 15h9M5 20h6',
    description: 'Generate filler text by words, sentences or paragraphs, starting from the classic phrase.',
    load: () => import('@/components/tools/LoremTool.vue'),
  },
  {
    id: 'password',
    name: 'Password Generator',
    category: 'Generators',
    keywords: ['password', 'passphrase', 'random', 'secure', 'generator', 'entropy', 'cryptographic'],
    icon: 'M12 3a4 4 0 0 0-4 4v2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V7a4 4 0 0 0-4-4zm-2 6V7a2 2 0 1 1 4 0v2z',
    description: 'CSPRNG passwords with character classes, unbiased sampling and an entropy readout.',
    load: () => import('@/components/tools/PasswordTool.vue'),
  },
  {
    id: 'escape',
    name: 'Escape / Unescape',
    category: 'Text',
    keywords: ['escape', 'unescape', 'json', 'xml', 'html', 'javascript', 'literal', 'encode', 'string'],
    icon: 'M9 6 4 12l5 6M15 6l5 6-5 6',
    description: 'Escape and unescape JSON strings, XML/HTML and JavaScript literals without evaluating anything.',
    load: () => import('@/components/tools/EscapeTool.vue'),
  },
  {
    id: 'analyzer',
    name: 'Text Analyzer & Utilities',
    category: 'Text',
    keywords: ['analyze', 'analyse', 'statistics', 'count', 'words', 'characters', 'sort', 'dedupe', 'case', 'camel', 'snake'],
    icon: 'M4 19V9M9 19V5M14 19v-7M19 19v-4',
    description: 'Unicode-aware text statistics plus line and identifier-case utilities.',
    load: () => import('@/components/tools/AnalyzerTool.vue'),
  },
  {
    id: 'listcompare',
    name: 'List Comparer',
    category: 'Text',
    keywords: ['list', 'compare', 'set', 'intersection', 'union', 'diff', 'duplicate', 'lines'],
    icon: 'M8 4v16M8 10h8m0 0V4m0 6v10',
    description: 'Set operations on two line lists: intersection, only-left/right, difference and union.',
    load: () => import('@/components/tools/ListCompareTool.vue'),
  },
  {
    id: 'jsontable',
    name: 'JSON Array to Table/CSV',
    category: 'Converters',
    keywords: ['json', 'table', 'csv', 'tsv', 'export', 'spreadsheet', 'rows', 'convert'],
    icon: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
    description: 'Render an array of objects as a table and export RFC-4180 CSV/TSV with safe-spreadsheet mode.',
    load: () => import('@/components/tools/JsonTableTool.vue'),
  },
  {
    id: 'yaml',
    name: 'JSON <> YAML',
    category: 'Converters',
    keywords: ['yaml', 'json', 'convert', 'serialize', 'config', 'yml'],
    icon: 'M4 6c2.5 0 2.5 3 5 3M4 12c2.5 0 2.5 3 5 3M14 6h6M14 12h6M14 18h4',
    description: 'Convert JSON to YAML and back with the YAML 1.2 core schema and bounded aliases.',
    load: () => import('@/components/tools/YamlTool.vue'),
  },
  {
    id: 'sql',
    name: 'SQL Formatter',
    category: 'Formatters',
    keywords: ['sql', 'format', 'pretty', 'query', 'dialect', 'postgres', 'mysql', 'sqlite'],
    icon: 'M5 5h14M5 12h9M5 19h12M17 15l3 2-3 2',
    description: 'Format SQL across the dialects sql-formatter supports, with keyword casing options.',
    load: () => import('@/components/tools/SqlTool.vue'),
  },
  {
    id: 'gzip',
    name: 'GZIP Compress / Decompress',
    category: 'Encoders & Decoders',
    keywords: ['gzip', 'zip', 'compress', 'decompress', 'deflate', 'archive', 'gunzip'],
    icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8',
    description: 'Stream compression with native APIs (pako fallback) and an output cap that stops decompression bombs.',
    load: () => import('@/components/tools/GzipTool.vue'),
  },
  {
    id: 'base64image',
    name: 'Base64 Image',
    category: 'Encoders & Decoders',
    keywords: ['base64', 'image', 'data url', 'png', 'jpeg', 'webp', 'picture', 'inline'],
    icon: 'M4 5h16v14H4zM8 11l3 3 3-4 4 5H6z',
    description: 'Convert an image file to a data URL and back, with dimension and pixel caps enforced before decoding.',
    load: () => import('@/components/tools/Base64ImageTool.vue'),
  },
  {
    id: 'html',
    name: 'HTML Encoder / Decoder',
    category: 'Encoders & Decoders',
    keywords: ['html', 'entity', 'entities', 'encode', 'decode', 'escape', 'unescape', 'amp', 'numeric'],
    icon: 'M9 6 4 12l5 6M15 6l5 6-5 6',
    description: 'Escape and decode HTML entities (named HTML4 set plus all numeric references) without ever rendering input.',
    load: () => import('@/components/tools/HtmlTool.vue'),
  },
  {
    id: 'qr',
    name: 'QR Code',
    category: 'Encoders & Decoders',
    keywords: ['qr', 'code', 'generate', 'decode', 'scan', 'barcode', 'matrix'],
    icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM19 14h1v1h-1z',
    description: 'Generate QR codes locally and decode them from image files. No camera access.',
    load: () => import('@/components/tools/QrTool.vue'),
  },
  {
    id: 'colorblind',
    name: 'Colour Blindness Simulator',
    category: 'Graphic',
    keywords: ['color', 'colour', 'blind', 'protan', 'deutan', 'tritan', 'achromat', 'accessibility', 'vision'],
    icon: 'M12 21s7-3.5 7-9V6l-7-3-7 3v6c0 5.5 7 9 7 9zM2 12s3-3.5 7-3.5M22 12s-3-3.5-7-3.5',
    description: 'Simulate protanopia, deuteranopia, tritanopia and achromatopsia on an image, at adjustable severity.',
    load: () => import('@/components/tools/ColorBlindTool.vue'),
  },
  {
    id: 'imageconvert',
    name: 'Image Converter',
    category: 'Graphic',
    keywords: ['image', 'convert', 'png', 'jpeg', 'webp', 'resize', 'batch', 'format'],
    icon: 'M4 16l4-5 3 3 4-6 5 8M4 5h16v14H4zM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0',
    description: 'Convert images to PNG, JPEG or WebP locally with a quality option; batches run one image at a time.',
    load: () => import('@/components/tools/ImageConverterTool.vue'),
  },
  {
    id: 'cron',
    name: 'Cron Parser',
    category: 'Converters',
    keywords: ['cron', 'schedule', 'crontab', 'expression', 'next run', 'timezone', 'periodic'],
    icon: 'M12 8V4M12 20v-4M8.5 6.2 6.2 4M17.8 17.8l-2.3-2.3M4 12h4M20 12h-4M8.5 17.8 6.2 20M17.8 6.2l-2.3 2.3M12 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    description: 'Validate 5- or 6-field cron expressions, read them in English, and see the next runs in any timezone.',
    load: () => import('@/components/tools/CronTool.vue'),
  },
  {
    id: 'jwt',
    name: 'JWT Decoder',
    category: 'Encoders & Decoders',
    keywords: ['jwt', 'token', 'json web token', 'bearer', 'decode', 'claims', 'auth'],
    icon: 'M15 8a4 4 0 1 1-3.9 5H8l-2 2v3H3v-4l5.1-5.1A4 4 0 0 1 15 8zM15.5 7.5h.01',
    description: 'Decode JWT headers and payloads locally, with human-readable dates. Signatures are never verified.',
    load: () => import('@/components/tools/JwtTool.vue'),
  },
  {
    id: 'jsonpath',
    name: 'JSONPath Tester',
    category: 'Testers',
    keywords: ['jsonpath', 'json', 'query', 'path', 'expression', 'filter', 'tester'],
    icon: 'M4 6h16M4 12h10M4 18h7M17 15l3 2-3 2',
    description: 'Test JSONPath queries against JSON with a safe in-house engine (no eval, no code generation).',
    load: () => import('@/components/tools/JsonPathTool.vue'),
  },
  {
    id: 'markdown',
    name: 'Markdown Preview',
    category: 'Text',
    keywords: ['markdown', 'md', 'preview', 'render', 'readme', 'gfm', 'html'],
    icon: 'M4 5h16v14H4zM8 15l3-6 2.5 4L15 11l1 4',
    description: 'Render Markdown locally in a sandboxed preview with unsafe HTML and remote images blocked.',
    load: () => import('@/components/tools/MarkdownTool.vue'),
  },
  {
    id: 'xml',
    name: 'XML Formatter & Validator',
    category: 'Formatters',
    keywords: ['xml', 'format', 'validate', 'well-formed', 'pretty', 'minify'],
    icon: 'M9 4 4 12l5 8M15 4l5 8-5 8',
    description: 'Check XML well-formedness and format or minify it. DTDs, DOCTYPEs and entities are rejected.',
    load: () => import('@/components/tools/XmlTool.vue'),
  },
  {
    id: 'xsd',
    name: 'XML / XSD Tester',
    category: 'Testers',
    keywords: ['xml', 'xsd', 'schema', 'validate', 'libxml2', 'wasm'],
    icon: 'M4 5h16v14H4zM4 10h16M4 15h10M9 5v14',
    description: 'Validate XML against an XSD schema locally (libxml2 in WebAssembly, in a dedicated worker).',
    load: () => import('@/components/tools/XsdTool.vue'),
  },
  {
    id: 'certificate',
    name: 'Certificate Decoder',
    category: 'Encoders & Decoders',
    keywords: ['certificate', 'x509', 'pem', 'der', 'asn1', 'tls', 'ssl', 'fingerprint'],
    icon: 'M12 3a4 4 0 0 0-4 4v2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V7a4 4 0 0 0-4-4zM9 15l1.8 1.8L15 12',
    description: 'Decode PEM/DER X.509 certificates locally: subject, issuer, validity, SAN, key usage, fingerprints. No trust evaluation.',
    load: () => import('@/components/tools/CertificateTool.vue'),
  },
]

export const CATEGORIES: readonly ToolCategory[] = [
  'Converters',
  'Encoders & Decoders',
  'Formatters',
  'Generators',
  'Graphic',
  'Testers',
  'Text',
]

export function findTool(id: string): ToolMeta | undefined {
  return TOOLS.find((tool) => tool.id === id)
}

export type ToolScore = { tool: ToolMeta; score: number }

/**
 * Case-insensitive name + keyword + description match used by the home search.
 * Multi-term queries are ANDed: every term must match somewhere for a tool to
 * qualify, then hits are ranked with name > keyword > description.
 */
export function searchTools(query: string): ToolMeta[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...TOOLS]
  const terms = q.split(/\s+/)
  const scored: ToolScore[] = []
  for (const tool of TOOLS) {
    const haystack = `${tool.name} ${tool.category} ${tool.description} ${tool.keywords.join(' ')}`.toLowerCase()
    let score = 0
    let matchedAll = true
    for (const term of terms) {
      let termScore = 0
      if (tool.name.toLowerCase().includes(term)) termScore += 3
      if (tool.keywords.some((k) => k.toLowerCase().includes(term))) termScore += 2
      if (haystack.includes(term)) termScore += 1
      if (termScore === 0) matchedAll = false
      score += termScore
    }
    if (matchedAll && score > 0) scored.push({ tool, score })
  }
  return scored.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name)).map((s) => s.tool)
}
