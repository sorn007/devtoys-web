/**
 * X.509 certificate DECODER — in-house, dependency-free.
 *
 * DECODE ONLY: this reads the fields a certificate asserts about itself. It
 * performs NO trust evaluation, no chain building, no revocation check, and
 * never claims a certificate is "valid" in the trust sense — the UI says so.
 * No network access exists in this module.
 *
 * Parses PEM (base64 body) or raw DER (base64/hex), walks the ASN.1 DER
 * structure with a strict TLV reader (any length past the buffer is rejected
 * as truncated), and computes SHA-1/SHA-256 fingerprints with WebCrypto.
 */

export const CERT_MAX_INPUT_CHARS = 200_000

export type CertField = { key: string; value: string }

export type CertificateInfo = {
  subject: CertField[]
  issuer: CertField[]
  serialHex: string
  signatureAlgorithm: string
  notBefore: string
  notAfter: string
  publicKeyAlgorithm: string
  publicKeyBits: number
  subjectAltNames: string[]
  keyUsage: string[]
  extendedKeyUsage: string[]
  isCA: boolean | null
  version: number
  fingerprints: { sha1: string; sha256: string }
  pemBlocksFound: number
}

export type CertResult = { ok: true; info: CertificateInfo } | { ok: false; error: string }

/** Accepts PEM, base64 DER, or hex DER. */
export function parseCertificate(text: string, sha1Hex: string, sha256Hex: string): CertResult {
  if (!text.trim()) return { ok: false, error: 'Paste a PEM certificate (or base64/hex DER).' }
  if (text.length > CERT_MAX_INPUT_CHARS) {
    return { ok: false, error: `Input is capped at ${CERT_MAX_INPUT_CHARS.toLocaleString()} characters.` }
  }
  const blocks = [...text.matchAll(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g)]
  const pemBlocksFound = blocks.length
  let der: Uint8Array
  if (pemBlocksFound > 0) {
    const body = blocks[0]![1]!.replace(/\s+/g, '')
    if (pemBlocksFound > 1) {
      // Decode the first block and say how many were found; chain display is out of scope.
      void body
    }
    try {
      der = base64ToBytes(body)
    } catch {
      return { ok: false, error: 'The PEM body is not valid base64.' }
    }
  } else if (/^[0-9a-f]+$/i.test(text.replace(/\s+/g, '')) && text.replace(/\s+/g, '').length % 2 === 0) {
    der = hexToBytes(text.replace(/\s+/g, ''))
  } else {
    const clean = text.replace(/\s+/g, '')
    try {
      der = base64ToBytes(clean)
    } catch {
      return { ok: false, error: 'Input is neither PEM, base64 DER nor hex DER.' }
    }
  }
  try {
    const info = parseDerCertificate(der)
    return { ok: true, info: { ...info, fingerprints: { sha1: sha1Hex, sha256: sha256Hex }, pemBlocksFound } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/* --- strict DER reader ---------------------------------------------------- */

class Reader {
  constructor(private readonly buf: Uint8Array, public pos = 0) {}
  byte(): number {
    if (this.pos >= this.buf.length) throw new Error('Truncated DER: unexpected end of data.')
    return this.buf[this.pos++]!
  }
  bytes(n: number): Uint8Array {
    if (n < 0 || this.pos + n > this.buf.length) throw new Error('Truncated DER: length exceeds the available data.')
    const out = this.buf.subarray(this.pos, this.pos + n)
    this.pos += n
    return out
  }
  /** Reads one TLV; returns tag, content and the end position. */
  tlv(): { tag: number; content: Uint8Array } {
    const tag = this.byte()
    let len = this.byte()
    if (len & 0x80) {
      const n = len & 0x7f
      if (n === 0 || n > 4) throw new Error('Unsupported DER length form.')
      len = 0
      for (let i = 0; i < n; i++) len = len * 256 + this.byte()
    }
    if (len < 0 || this.pos + len > this.buf.length) throw new Error('Truncated DER: length exceeds the available data.')
    return { tag, content: this.bytes(len) }
  }
  children(content: Uint8Array): Reader {
    return new Reader(content)
  }
}

/* --- X.509 structure ------------------------------------------------------ */

function parseDerCertificate(der: Uint8Array): Omit<CertificateInfo, 'fingerprints' | 'pemBlocksFound'> {
  const root = new Reader(der).tlv()
  if (root.tag !== 0x30) throw new Error('Not an X.509 certificate (expected a DER SEQUENCE at the root).')
  const cert = new Reader(root.content)
  const tbs = cert.tlv()
  if (tbs.tag !== 0x30) throw new Error('Not an X.509 certificate (missing TBSCertificate).')
  const sigAlgOuter = cert.tlv() // signatureAlgorithm (after TBS)
  void sigAlgOuter

  const tbsReader = new Reader(tbs.content)
  let version = 1
  let first = tbsReader.tlv()
  if (first.tag === 0xa0) {
    // [0] EXPLICIT version
    const v = new Reader(first.content).tlv()
    version = (v.content[0] ?? 0) + 1
    first = tbsReader.tlv()
  }
  const serialBytes = first.tag === 0x02 ? first.content : throwInvalid('serial number')
  const serialHex = [...serialBytes].map((b) => b.toString(16).padStart(2, '0')).join('').replace(/^0+(?=.)/, '')

  const sigAlgTlv = tbsReader.tlv()
  const signatureAlgorithm = oidName(readAlgorithmOid(sigAlgTlv.content))
  const issuer = readName(tbsReader.tlv())
  const validity = tbsReader.tlv()
  const validityReader = new Reader(validity.content)
  const notBefore = readTime(validityReader.tlv())
  const notAfter = readTime(validityReader.tlv())
  const subject = readName(tbsReader.tlv())

  const spki = tbsReader.tlv()
  const spkiReader = new Reader(spki.content)
  const pkAlg = readAlgorithmOid(spkiReader.tlv().content)
  const pkBitsTlv = spkiReader.tlv()
  const { algorithm: publicKeyAlgorithm, bits } = readPublicKey(pkAlg, pkBitsTlv)

  let subjectAltNames: string[] = []
  let keyUsage: string[] = []
  let extendedKeyUsage: string[] = []
  let isCA: boolean | null = null
  const maybeExtensions = tbsReader.tlv()
  if (maybeExtensions.tag === 0xa3) {
    const extSeq = new Reader(maybeExtensions.content).tlv()
    const extReader = new Reader(extSeq.content)
    while (extReader.pos < extSeq.content.length) {
      const ext = extReader.tlv()
      if (ext.tag !== 0x30) continue
      const r = new Reader(ext.content)
      const oid = readOid(r.tlv().content)
      let value: Uint8Array | null = null
      for (;;) {
        const inner = r.tlv()
        if (inner.tag === 0x01) continue // critical flag
        if (inner.tag === 0x04) value = inner.content
        break
      }
      if (!value) continue
      if (oid === '2.5.29.17') subjectAltNames = readSan(value)
      if (oid === '2.5.29.15') keyUsage = readKeyUsage(value)
      if (oid === '2.5.29.37') extendedKeyUsage = readExtKeyUsage(value)
      if (oid === '2.5.29.19') isCA = readBasicConstraints(value)
    }
  }

  return {
    subject,
    issuer,
    serialHex,
    signatureAlgorithm,
    notBefore,
    notAfter,
    publicKeyAlgorithm,
    publicKeyBits: bits,
    subjectAltNames,
    keyUsage,
    extendedKeyUsage,
    isCA,
    version,
  }
}

function throwInvalid(what: string): never {
  throw new Error(`Malformed certificate: missing or invalid ${what}.`)
}

/** AlgorithmIdentifier ::= SEQUENCE { algorithm OID, parameters ANY } */
function readAlgorithmOid(content: Uint8Array): string {
  const tlv = new Reader(content).tlv()
  if (tlv.tag !== 0x06) throwInvalid('algorithm identifier OID')
  return readOid(tlv.content)
}

function readOid(content: Uint8Array): string {
  const parts: string[] = []
  let current = 0
  for (const b of content) {
    if (b === 0x80) continue
    current = (current << 7) | (b & 0x7f)
    if (!(b & 0x80)) {
      if (parts.length === 0) {
        parts.push(String(Math.floor(current / 40)), String(current % 40))
      } else parts.push(String(current))
      current = 0
    }
  }
  return parts.join('.')
}

const OID_NAMES: Record<string, string> = {
  '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
  '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
  '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
  '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption',
  '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256',
  '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
  '1.2.840.113549.1.1.1': 'rsaEncryption',
  '1.2.840.10045.2.1': 'ecPublicKey',
}
const NAME_OIDS: Record<string, string> = {
  '2.5.4.6': 'C',
  '2.5.4.8': 'ST',
  '2.5.4.7': 'L',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '2.5.4.3': 'CN',
  '2.5.4.5': 'serialNumber',
  '1.2.840.113549.1.9.1': 'emailAddress',
}
const KEY_USAGE_BITS = ['digitalSignature', 'nonRepudiation', 'keyEncipherment', 'dataEncipherment', 'keyAgreement', 'keyCertSign', 'cRLSign', 'encipherOnly', 'decipherOnly']
const EKU_OIDS: Record<string, string> = {
  '1.3.6.1.5.5.7.3.1': 'serverAuth',
  '1.3.6.1.5.5.7.3.2': 'clientAuth',
  '1.3.6.1.5.5.7.3.3': 'codeSigning',
  '1.3.6.1.5.5.7.3.4': 'emailProtection',
}

function oidName(oid: string): string {
  return OID_NAMES[oid] ?? oid
}

function readName(tlv: { tag: number; content: Uint8Array }): CertField[] {
  if (tlv.tag !== 0x30) throwInvalid('name (RDNSequence)')
  const r = new Reader(tlv.content)
  const fields: CertField[] = []
  while (r.pos < tlv.content.length) {
    const set = r.tlv()
    if (set.tag !== 0x31) continue
    const sr = new Reader(set.content)
    while (sr.pos < set.content.length) {
      const atv = sr.tlv()
      if (atv.tag !== 0x30) continue
      const ar = new Reader(atv.content)
      const oid = readOid(ar.tlv().content)
      const valueTlv = ar.tlv()
      const label = NAME_OIDS[oid] ?? oid
      fields.push({ key: label, value: decodeAsString(valueTlv.content) })
    }
  }
  return fields
}

function decodeAsString(bytes: Uint8Array): string {
  // PrintableString/UTF8String/IA5String/T61String all decode as text here.
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

function readTime(tlv: { tag: number; content: Uint8Array }): string {
  const raw = decodeAsString(tlv.content)
  // UTCTime YYMMDDHHMMSSZ / GeneralizedTime YYYYMMDDHHMMSSZ → ISO-ish.
  const m = /^(\d{2}|\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z?$/.exec(raw)
  if (!m) return raw
  let [, y, mo, d, h, mi, s] = m
  if (y!.length === 2) y = Number(y) < 50 ? `20${y}` : `19${y}`
  return `${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}Z`
}

function readPublicKey(algOid: string, bitString: { tag: number; content: Uint8Array }): { algorithm: string; bits: number } {
  if (bitString.tag !== 0x03) throwInvalid('subject public key')
  const der = bitString.content
  const data = der.length > 0 ? der.subarray(1) : der // skip the unused-bits octet
  const algorithm = oidName(algOid)
  if (algOid === '1.2.840.113549.1.1.1' && data.length > 0) {
    try {
      const seq = new Reader(data).tlv()
      const kr = new Reader(seq.content)
      const n = kr.tlv() // modulus INTEGER
      const byteLen = n.content.length - (n.content[0] === 0 ? 1 : 0)
      return { algorithm, bits: byteLen * 8 }
    } catch {
      return { algorithm, bits: data.byteLength * 8 }
    }
  }
  return { algorithm, bits: data.byteLength * 8 }
}

function readSan(value: Uint8Array): string[] {
  const out: string[] = []
  try {
    const seq = new Reader(value).tlv()
    const r = new Reader(seq.content)
    while (r.pos < seq.content.length) {
      const g = r.tlv()
      const text = decodeAsString(g.content)
      if (g.tag === 0x82) out.push(`DNS:${text}`)
      else if (g.tag === 0x81) out.push(`email:${text}`)
      else if (g.tag === 0x86) out.push(`URI:${text}`)
      else if (g.tag === 0x87) out.push(`IP:${[...g.content].join('.')}`)
      else out.push(`other:${text || `tag ${g.tag.toString(16)}`}`)
    }
  } catch {
    /* malformed SAN → report what we have */
  }
  return out
}

function readKeyUsage(value: Uint8Array): string[] {
  // Extension value ::= OCTET STRING wrapping a BIT STRING.
  const bitString = new Reader(value).tlv()
  if (bitString.tag !== 0x03 || bitString.content.length < 1) return []
  const unusedBits = bitString.content[0]!
  const bits = bitString.content.subarray(1)
  const total = bits.length * 8 - unusedBits
  const out: string[] = []
  for (let i = 0; i < Math.min(total, KEY_USAGE_BITS.length); i++) {
    if (bits[i >> 3]! & (0x80 >> (i & 7))) out.push(KEY_USAGE_BITS[i]!)
  }
  return out
}

function readExtKeyUsage(value: Uint8Array): string[] {
  const out: string[] = []
  try {
    const seq = new Reader(value).tlv()
    const r = new Reader(seq.content)
    while (r.pos < seq.content.length) {
      const oidTlv = r.tlv()
      if (oidTlv.tag !== 0x06) continue
      const oid = readOid(oidTlv.content)
      out.push(EKU_OIDS[oid] ?? oid)
    }
  } catch {
    /* ignore malformed EKU */
  }
  return out
}

function readBasicConstraints(value: Uint8Array): boolean | null {
  try {
    const seq = new Reader(value).tlv()
    const r = new Reader(seq.content)
    while (r.pos < seq.content.length) {
      const t = r.tlv()
      if (t.tag === 0x01) return t.content[0] === 0xff
    }
    return false
  } catch {
    return null
  }
}

/* --- input decoding ------------------------------------------------------- */

function base64ToBytes(input: string): Uint8Array {
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/').replace(/=+$/g, '')
  const binary = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function bytesToHexColon(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':')
}
