<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToolRunner } from '@/lib/useToolRunner'
import { crc32, HASH_ALGORITHMS, type HashAlgorithm, type HashResult } from '@/tools/hash'
import { md5 } from '@/tools/md5'
import { byteSize } from '@/tools/json'
import { copyText } from '@/lib/clipboard'

const { run, busy } = useToolRunner()

const input = ref('')
const algorithm = ref<HashAlgorithm | 'CRC-32' | 'MD5'>('SHA-256')
type AnyDigest = HashResult | { algorithm: 'CRC-32' | 'MD5'; hex: string; base64: string; bytes: number }
const result = ref<AnyDigest | null>(null)
const error = ref<string | null>(null)
const note = ref('')

/** SHA-1 is provided for compatibility only; it is not a secure digest and the UI says so. */

async function go(): Promise<void> {
  error.value = null
  note.value = ''
  try {
    result.value =
      algorithm.value === 'CRC-32'
        ? { algorithm: 'CRC-32', hex: crc32(input.value), base64: '', bytes: new TextEncoder().encode(input.value).length }
        : algorithm.value === 'MD5'
          ? { algorithm: 'MD5', hex: md5(input.value), base64: '', bytes: new TextEncoder().encode(input.value).length }
        : await run<AnyDigest>(input.value.length, 'hash', { input: input.value, algorithm: algorithm.value })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    result.value = null
  }
}

const expectedLength = computed(() => ({ 'SHA-1': 40, 'SHA-256': 64, 'SHA-384': 96, 'SHA-512': 128, 'CRC-32': 8, MD5: 32 }[algorithm.value]))
const legacy = computed(() => algorithm.value === 'SHA-1' || algorithm.value === 'MD5')

async function copy(): Promise<void> {
  if (result.value) note.value = await copyText(result.value.hex)
}

</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>Hash &amp; Checksum</h1>
      <p>SHA-256/384/512 digests (WebCrypto), plus SHA-1 and CRC-32 for compatibility.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="hash-in">Input</label>
        <span>{{ input.length.toLocaleString() }} chars · {{ byteSize(input).toLocaleString() }} bytes UTF-8</span>
      </div>
      <textarea id="hash-in" v-model="input" spellcheck="false" placeholder="Text to hash…"></textarea>
    </div>

    <div class="row">
      <label class="field">
        Algorithm
        <select v-model="algorithm" style="width: auto">
          <option v-for="a in HASH_ALGORITHMS" :key="a" :value="a">{{ a }}</option>
          <option value="CRC-32">CRC-32</option>
          <option value="MD5">MD5 — legacy</option>
        </select>
      </label>
      <button class="btn primary" type="button" :disabled="busy || !input" @click="go()">Hash</button>
      <span v-if="legacy" class="badge warn">legacy — broken for security; use only for compatibility</span>
    </div>

    <p v-if="error" class="msg bad">{{ error }}</p>

    <div v-if="result" class="pane">
      <div class="pane-label">
        <label>{{ result.algorithm }} (hex)</label>
        <button class="btn" type="button" @click="copy()">Copy</button>
      </div>
      <dl class="kv">
        <dt>hex</dt>
        <dd>{{ result.hex }}</dd>
        <template v-if="result.base64">
          <dt>base64</dt>
          <dd>{{ result.base64 }}</dd>
        </template>
        <dt>input bytes</dt>
        <dd>{{ result.bytes.toLocaleString() }}</dd>
      </dl>
      <span v-if="note" class="badge">{{ note }}</span>
      <p class="msg dim">
        Expected hex length {{ expectedLength }} characters.
        <span v-if="result.hex.length !== expectedLength" class="badge bad">length mismatch</span>
        <span v-else class="badge ok">length ok</span>
      </p>
    </div>
  </section>
</template>
