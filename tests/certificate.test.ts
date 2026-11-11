import { describe, expect, it } from 'vitest'
import { parseCertificate } from '@/tools/certificate'

// Real certificate generated with openssl for this test suite (openssl req -x509,
// RSA-2048, subject /C=DE/ST=Berlin/L=Berlin/O=Toolbox Test/CN=toolbox.test,
// SAN DNS:toolbox.test + DNS:www.toolbox.test + IP:127.0.0.1, keyUsage
// digitalSignature+keyEncipherment). Reference values below come from
// `openssl x509 -text -fingerprint` output, not from this parser.
const PEM = "-----BEGIN CERTIFICATE-----\nMIID2zCCAsOgAwIBAgIULP7IgRbzXiOmcrUm+xT2lf/lmhMwDQYJKoZIhvcNAQEL\nBQAwXTELMAkGA1UEBhMCREUxDzANBgNVBAgMBkJlcmxpbjEPMA0GA1UEBwwGQmVy\nbGluMRUwEwYDVQQKDAxUb29sYm94IFRlc3QxFTATBgNVBAMMDHRvb2xib3gudGVz\ndDAeFw0yNjExMTAxMDU3MjRaFw0zNjExMDcxMDU3MjRaMF0xCzAJBgNVBAYTAkRF\nMQ8wDQYDVQQIDAZCZXJsaW4xDzANBgNVBAcMBkJlcmxpbjEVMBMGA1UECgwMVG9v\nbGJveCBUZXN0MRUwEwYDVQQDDAx0b29sYm94LnRlc3QwggEiMA0GCSqGSIb3DQEB\nAQUAA4IBDwAwggEKAoIBAQDDgJO/rJwPgBMXsIQm7yw9HdpLyzXu4YDqXq1ctHxY\nl1/Vckngq3/1RsdMOueIkdEu8bt7lJ6ATykRKpp9COejhcQrmD7ld0KZ5YUtXwjp\n6wMKpONoBaRa74OtK5IuDmcTWdgQ3iFgrVwLTfsTRLRo2Ba7SJTAChUTb+K4I1I4\nGTspqoqgF9nSGjpi6nKJZXh6Gm5WMRv4EswaXj7Y5Ty5nDTbhXm6dxJ5ByYD9tlD\nQJgO2l95UKwwOZvnwqcBeOcjUdn7MoZrq0jZT2rBhO4hkn2qWjLFuTewTr2+vvww\n9iZTxCRmd3pEsVWjKsBP6zCDLOerYDaNWSw/rAMKd+LvAgMBAAGjgZIwgY8wHQYD\nVR0OBBYEFGumHjs4mZlEUWq3qD3OeygtWfMbMB8GA1UdIwQYMBaAFGumHjs4mZlE\nUWq3qD3OeygtWfMbMA8GA1UdEwEB/wQFMAMBAf8wLwYDVR0RBCgwJoIMdG9vbGJv\neC50ZXN0ghB3d3cudG9vbGJveC50ZXN0hwR/AAABMAsGA1UdDwQEAwIFoDANBgkq\nhkiG9w0BAQsFAAOCAQEAqXm0lDdYy+ZvSL/d4uT8LcUMwuxkr2I30pxz+SpFDgCT\nT6KNpq9ZWO/EP+vqfiqJ1UnFmkViGcPVWaGiKwPqZDFof5qw1AFSoD/cy/P9Fzdy\nfDxQSWf7NbemXCWCum6nGvMBLXctC/wo7lq+AI8JxWyfE518o1AV5lFb+cej/r6D\n9lrT1//bN1kC0P5EKVDtZA/iWDwXlk/Gm99sL1iYXJ7j2iH9qD8TsXNbRUHnapvF\nzg0gOYDiCW20B1g0ZTROajKwmt2F8YwNeoyKXxAu3XoROCqsGWOvuwIPwm9mqjst\nqqnzI8KrXGe1V+33rEZ83gLymwoBVL40NDeYaVVZLg==\n-----END CERTIFICATE-----\n"
const DER_HEX = "308203db308202c3a00302010202142cfec88116f35e23a672b526fb14f695ffe59a13300d06092a864886f70d01010b0500305d310b3009060355040613024445310f300d06035504080c064265726c696e310f300d06035504070c064265726c696e31153013060355040a0c0c546f6f6c626f7820546573743115301306035504030c0c746f6f6c626f782e74657374301e170d3236313131303130353732345a170d3336313130373130353732345a305d310b3009060355040613024445310f300d06035504080c064265726c696e310f300d06035504070c064265726c696e31153013060355040a0c0c546f6f6c626f7820546573743115301306035504030c0c746f6f6c626f782e7465737430820122300d06092a864886f70d01010105000382010f003082010a0282010100c38093bfac9c0f801317b08426ef2c3d1dda4bcb35eee180ea5ead5cb47c58975fd57249e0ab7ff546c74c3ae78891d12ef1bb7b949e804f29112a9a7d08e7a385c42b983ee5774299e5852d5f08e9eb030aa4e36805a45aef83ad2b922e0e671359d810de2160ad5c0b4dfb1344b468d816bb4894c00a15136fe2b8235238193b29aa8aa017d9d21a3a62ea728965787a1a6e56311bf812cc1a5e3ed8e53cb99c34db8579ba771279072603f6d94340980eda5f7950ac30399be7c2a70178e72351d9fb32866bab48d94f6ac184ee21927daa5a32c5b937b04ebdbebefc30f62653c42466777a44b155a32ac04feb30832ce7ab60368d592c3fac030a77e2ef0203010001a3819230818f301d0603551d0e041604146ba61e3b38999944516ab7a83dce7b282d59f31b301f0603551d230418301680146ba61e3b38999944516ab7a83dce7b282d59f31b300f0603551d130101ff040530030101ff302f0603551d1104283026820c746f6f6c626f782e7465737482107777772e746f6f6c626f782e7465737487047f000001300b0603551d0f0404030205a0300d06092a864886f70d01010b05000382010100a979b4943758cbe66f48bfdde2e4fc2dc50cc2ec64af6237d29c73f92a450e00934fa28da6af5958efc43febea7e2a89d549c59a456219c3d559a1a22b03ea6431687f9ab0d40152a03fdccbf3fd1737727c3c504967fb35b7a65c2582ba6ea71af3012d772d0bfc28ee5abe008f09c56c9f139d7ca35015e6515bf9c7a3febe83f65ad3d7ffdb375902d0fe442950ed640fe2583c17964fc69bdf6c2f58985c9ee3da21fda83f13b1735b4541e76a9bc5ce0d203980e2096db407583465344e6a32b09add85f18c0d7a8c8a5f102edd7a11382aac1963afbb020fc26f66aa3b2daaa9f323c2ab5c67b557edf7ac467cde02f29b0a0154be343437986955592e"
// openssl x509 -noout -fingerprint -sha256 / -sha1 over the same certificate:
const SHA256 = 'D5:F2:1E:9C:70:8D:11:A2:56:B5:A9:38:EE:5B:AA:CF:C9:DD:0E:04:C7:6D:2F:BC:C7:33:9C:54:57:B5:52:72'
const SHA1 = '50:D2:57:ED:9A:70:19:EC:88:C6:9D:86:A8:2B:D7:04:23:5A:44:E7'

describe('certificate decoder (PEM)', () => {
  const r = parseCertificate(PEM, SHA1, SHA256)

  it('parses subject and issuer', () => {
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const subject = Object.fromEntries(r.info.subject.map((f) => [f.key, f.value]))
    expect(subject.CN).toBe('toolbox.test')
    expect(subject.O).toBe('Toolbox Test')
    expect(subject.C).toBe('DE')
    const issuer = Object.fromEntries(r.info.issuer.map((f) => [f.key, f.value]))
    expect(issuer.CN).toBe('toolbox.test') // self-signed
  })

  it('reads algorithm, key size, version and validity window', () => {
    if (!r.ok) throw new Error('parse failed')
    expect(r.info.signatureAlgorithm).toBe('sha256WithRSAEncryption')
    expect(r.info.publicKeyAlgorithm).toBe('rsaEncryption')
    expect(r.info.publicKeyBits).toBe(2048)
    expect(r.info.version).toBe(3)
    expect(r.info.notBefore).toMatch(/^2026-11-10T/)
    expect(r.info.notAfter).toMatch(/^2036-11-07T/)
  })

  it('reads SAN and key usage', () => {
    if (!r.ok) throw new Error('parse failed')
    expect(r.info.subjectAltNames).toContain('DNS:toolbox.test')
    expect(r.info.subjectAltNames).toContain('DNS:www.toolbox.test')
    expect(r.info.subjectAltNames).toContain('IP:127.0.0.1')
    expect(r.info.keyUsage).toContain('digitalSignature')
    expect(r.info.keyUsage).toContain('keyEncipherment')
  })

  it('reports serial and passes fingerprints through', () => {
    if (!r.ok) throw new Error('parse failed')
    expect(r.info.serialHex).toMatch(/^[0-9a-f]+$/)
    expect(r.info.fingerprints.sha256).toBe(SHA256)
    expect(r.info.fingerprints.sha1).toBe(SHA1)
  })
})

describe('certificate decoder (DER hex and base64)', () => {
  it('accepts raw DER as hex', () => {
    const r = parseCertificate(DER_HEX, SHA1, SHA256)
    expect(r.ok).toBe(true)
    if (r.ok) expect(Object.fromEntries(r.info.subject.map((f) => [f.key, f.value])).CN).toBe('toolbox.test')
  })

  it('accepts DER as base64 (the PEM body without the armor)', () => {
    const body = PEM.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
    const r = parseCertificate(body, SHA1, SHA256)
    expect(r.ok).toBe(true)
  })
})

describe('certificate decoder rejects malformed input', () => {
  it('rejects truncated DER with a specific error', () => {
    // Drop the last 10 bytes: header stays valid, content runs past the end.
    const truncated = DER_HEX.slice(0, DER_HEX.length - 20)
    const r = parseCertificate(truncated, '', '')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Truncated|end of data/i)
  })

  it('rejects garbage and empty input', () => {
    expect(parseCertificate('not a certificate at all', '', '').ok).toBe(false)
    expect(parseCertificate('', '', '').ok).toBe(false)
  })

  it('enforces the input cap', () => {
    const r = parseCertificate(PEM.repeat(400), '', '')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/capped/i)
  })

  it('counts multiple PEM blocks and decodes the first', () => {
    const r = parseCertificate(PEM + PEM, SHA1, SHA256)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.info.pemBlocksFound).toBe(2)
  })
})
