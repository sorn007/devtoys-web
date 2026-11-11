<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDedicatedWorker } from '@/lib/useDedicatedWorker'
import { useObjectUrls } from '@/lib/objectUrls'

const { run, busy, cancel } = useDedicatedWorker(
  () => new Worker(new URL('../../workers/qrWorker.ts', import.meta.url), { type: 'module' }),
)
const urls = useObjectUrls()

const text = ref('')
const ec = ref<'L' | 'M' | 'Q' | 'H'>('M')
const scale = ref(6)
const pngUrl = ref('')
const pngBytes = ref(0)
const decoded = ref('')
const error = ref<string | null>(null)
const decodeError = ref<string | null>(null)
const qrSize = ref(0)

onMounted(() => void generate())

async function generate(): Promise<void> {
  error.value = null
  clearPng()
  if (!text.value.trim()) return
  try {
    const r = await run<{ blob: Uint8Array; mime: string; size: number }>('qr-create', {
      text: text.value,
      ec: ec.value,
      scale: scale.value,
    })
    qrSize.value = r.size
    pngBytes.value = r.blob.byteLength
    pngUrl.value = urls.create(new Blob([r.blob as unknown as BlobPart], { type: r.mime }))
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

async function onDecodeFile(event: Event): Promise<void> {
  decodeError.value = null
  decoded.value = ''
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const r = await run<{ text: string | null }>('qr-decode', { data: bytes })
    if (r.text === null) decodeError.value = 'No QR code found in that image.'
    else decoded.value = r.text
  } catch (err) {
    decodeError.value = err instanceof Error ? err.message : String(err)
  }
}

function clearPng(): void {
  if (pngUrl.value) {
    urls.revoke(pngUrl.value)
    pngUrl.value = ''
  }
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>QR Code</h1>
      <p>Generate a QR code locally and decode one from an image file. No camera access is used or requested.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="qr-text">Text or URL</label>
        <span>{{ text.length.toLocaleString() }} chars</span>
      </div>
      <textarea id="qr-text" v-model="text" rows="3" spellcheck="false" placeholder="https://example.com" @input="generate()"></textarea>
    </div>

    <div class="row">
      <label class="field">
        Error correction
        <select v-model="ec" style="width: auto" @change="generate()">
          <option value="L">L — 7%</option>
          <option value="M">M — 15%</option>
          <option value="Q">Q — 25%</option>
          <option value="H">H — 30%</option>
        </select>
      </label>
      <label class="field">
        Module size
        <input v-model.number="scale" type="number" min="1" max="32" style="width: 80px" @input="generate()" />
      </label>
      <button v-if="busy" class="btn" type="button" @click="cancel()">Cancel</button>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>

    <div v-if="pngUrl" class="row" style="align-items: flex-start; flex-wrap: wrap">
      <img :src="pngUrl" alt="Generated QR code" style="max-width: 280px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: #fff" />
      <div class="pane" style="flex: 1 1 260px">
        <div class="pane-label"><label>PNG</label></div>
        <dl class="kv">
          <dt>modules</dt><dd>{{ qrSize }} × {{ qrSize }}</dd>
          <dt>bytes</dt><dd>{{ pngBytes.toLocaleString() }}</dd>
        </dl>
        <a class="btn" :href="pngUrl" download="qr-code.png">Download PNG</a>
      </div>
    </div>

    <div class="pane">
      <div class="pane-label"><label>Decode a QR code from an image</label></div>
      <div class="row">
        <input type="file" accept="image/*" @change="onDecodeFile" />
        <span v-if="busy" class="badge">decoding in a worker…</span>
      </div>
      <p v-if="decodeError" class="msg bad" role="alert">{{ decodeError }}</p>
      <div v-if="decoded" class="pane">
        <div class="pane-label"><label for="qr-decoded">Decoded text</label></div>
        <textarea id="qr-decoded" class="auto-height" readonly :value="decoded"></textarea>
      </div>
    </div>
  </section>
</template>
