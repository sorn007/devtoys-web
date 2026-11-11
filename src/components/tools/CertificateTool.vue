<script setup lang="ts">
import { ref } from 'vue'
import { bytesToHexColon, parseCertificate, type CertificateInfo } from '@/tools/certificate'
import { copyText } from '@/lib/clipboard'

const input = ref('')
const info = ref<CertificateInfo | null>(null)
const error = ref<string | null>(null)
const note = ref('')

async function decode(): Promise<void> {
  error.value = null
  note.value = ''
  info.value = null
  const text = input.value
  // Fingerprints are computed over the DER bytes with WebCrypto (local, no network).
  const blocks = [...text.matchAll(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g)]
  let der: Uint8Array | null = null
  if (blocks.length > 0) {
    const body = blocks[0]![1]!.replace(/\s+/g, '')
    der = base64(body)
  } else if (/^[0-9a-f]+$/i.test(text.replace(/\s+/g, '')) && text.replace(/\s+/g, '').length % 2 === 0) {
    const hex = text.replace(/\s+/g, '')
    der = new Uint8Array(hex.length / 2)
    for (let i = 0; i < der.length; i++) der[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  } else {
    try {
      der = base64(text.replace(/\s+/g, ''))
    } catch {
      der = null
    }
  }
  let sha1 = ''
  let sha256 = ''
  if (der) {
    sha1 = bytesToHexColon(new Uint8Array(await crypto.subtle.digest('SHA-1', der as unknown as ArrayBuffer)))
    sha256 = bytesToHexColon(new Uint8Array(await crypto.subtle.digest('SHA-256', der as unknown as ArrayBuffer)))
  }
  const result = parseCertificate(text, sha1, sha256)
  if (result.ok) info.value = result.info
  else error.value = result.error
}

function base64(clean: string): Uint8Array {
  const normalized = clean.replaceAll('-', '+').replaceAll('_', '/').replace(/=+$/g, '')
  const binary = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

async function copy(text: string): Promise<void> {
  note.value = await copyText(text)
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>Certificate Decoder</h1>
      <p>Decode X.509 certificates (PEM or DER). <strong>Decode only</strong> — no chain, trust or revocation checking is performed or implied.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="cert-in">Certificate</label>
        <span>{{ input.length.toLocaleString() }} chars · never sent anywhere</span>
      </div>
      <textarea id="cert-in" v-model="input" class="mono" spellcheck="false" style="min-height: 110px" placeholder="-----BEGIN CERTIFICATE-----&#10;MIID…&#10;-----END CERTIFICATE-----" @input="decode()"></textarea>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>

    <template v-if="info">
      <div class="row">
        <span class="badge warn">decoded — trust NOT evaluated</span>
        <span class="badge">{{ info.publicKeyAlgorithm }} {{ info.publicKeyBits }}-bit</span>
        <span class="badge">{{ info.signatureAlgorithm }}</span>
        <span class="badge">v{{ info.version }}</span>
        <span v-if="info.pemBlocksFound > 1" class="badge warn">{{ info.pemBlocksFound }} PEM blocks found — showing the first</span>
      </div>

      <div class="pane">
        <div class="pane-label"><label>Subject</label></div>
        <dl class="kv">
          <template v-for="f in info.subject" :key="f.key + f.value">
            <dt>{{ f.key }}</dt><dd>{{ f.value }}</dd>
          </template>
        </dl>
      </div>

      <div class="pane">
        <div class="pane-label"><label>Issuer</label></div>
        <dl class="kv">
          <template v-for="f in info.issuer" :key="f.key + f.value">
            <dt>{{ f.key }}</dt><dd>{{ f.value }}</dd>
          </template>
        </dl>
      </div>

      <div class="pane">
        <div class="pane-label"><label>Validity &amp; identity</label></div>
        <dl class="kv">
          <dt>serial</dt><dd>{{ info.serialHex }}</dd>
          <dt>not before</dt><dd>{{ info.notBefore }}</dd>
          <dt>not after</dt><dd>{{ info.notAfter }}</dd>
          <template v-if="info.isCA !== null">
            <dt>basicConstraints</dt><dd>{{ info.isCA ? 'CA:TRUE' : 'CA:FALSE' }}</dd>
          </template>
        </dl>
      </div>

      <div v-if="info.subjectAltNames.length" class="pane">
        <div class="pane-label"><label>Subject Alternative Names</label></div>
        <div class="list-box"><div v-for="(s, i) in info.subjectAltNames" :key="i">{{ s }}</div></div>
      </div>

      <div v-if="info.keyUsage.length || info.extendedKeyUsage.length" class="pane">
        <div class="pane-label"><label>Key usage</label></div>
        <div class="chips">
          <span v-for="k in info.keyUsage" :key="k" class="chip on">{{ k }}</span>
          <span v-for="k in info.extendedKeyUsage" :key="k" class="chip">{{ k }}</span>
        </div>
      </div>

      <div class="pane">
        <div class="pane-label">
          <label>Fingerprints (over the DER bytes)</label>
          <button class="btn" type="button" @click="copy(info!.fingerprints.sha256)">Copy SHA-256</button>
        </div>
        <dl class="kv">
          <dt>SHA-1</dt><dd>{{ info.fingerprints.sha1 }}</dd>
          <dt>SHA-256</dt><dd>{{ info.fingerprints.sha256 }}</dd>
        </dl>
        <span v-if="note" class="badge">{{ note }}</span>
      </div>

      <p class="msg dim">Fields above are read from the certificate itself. Nothing here proves the certificate is trustworthy: no chain building, trust-anchor check, OCSP/CRL or signature verification is performed.</p>
    </template>
  </section>
</template>
