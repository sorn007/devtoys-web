<script setup lang="ts">
import { ref } from 'vue'
import { assertImageWithinLimits, bytesToDataUrl, describeImage, parseDataUrl, probeImage, type ImageFacts } from '@/tools/base64image'
import { useObjectUrls } from '@/lib/objectUrls'
import { copyText } from '@/lib/clipboard'

const urls = useObjectUrls()

const dataUrl = ref('')
const facts = ref<ImageFacts | null>(null)
const error = ref<string | null>(null)
const note = ref('')
const previewUrl = ref('')
const decodeUrl = ref('')

async function onFile(event: Event): Promise<void> {
  error.value = null
  facts.value = null
  clearPreview()
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const url = bytesToDataUrl(bytes, file.type || 'application/octet-stream')
    // Enforce caps BEFORE handing the URL to a decode.
    const { width, height } = await probeImage(url)
    assertImageWithinLimits(width, height)
    dataUrl.value = url
    facts.value = describeImage(file.type || 'application/octet-stream', bytes, width, height)
    previewUrl.value = url
  } catch (err) {
    dataUrl.value = ''
    error.value = err instanceof Error ? err.message : String(err)
  }
}

async function decode(): Promise<void> {
  error.value = null
  clearDecode()
  try {
    const parsed = parseDataUrl(dataUrl.value)
    if (!parsed.ok) {
      error.value = parsed.error
      return
    }
    const blob = new Blob([parsed.bytes as unknown as BlobPart], { type: parsed.mime })
    const url = urls.create(blob)
    const { width, height } = await probeImage(url)
    assertImageWithinLimits(width, height)
    decodeUrl.value = url
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

function clearPreview(): void {
  // data: URLs need no revocation; only tracked blob URLs do.
  previewUrl.value = ''
}

function clearDecode(): void {
  if (decodeUrl.value) {
    urls.revoke(decodeUrl.value)
    decodeUrl.value = ''
  }
}

async function copy(): Promise<void> {
  note.value = await copyText(dataUrl.value)
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>Base64 Image</h1>
      <p>File → data URL (with dimensions and size) and back. Decoded images are capped at 40 million pixels / 12,000px per side before decoding.</p>
    </div>

    <div class="row">
      <label class="field">
        Choose an image
        <input type="file" accept="image/*" @change="onFile" />
      </label>
      <button class="btn" type="button" @click="decode()" :disabled="!dataUrl.trim()">Decode data URL → image</button>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>

    <div v-if="facts" class="pane">
      <div class="pane-label"><label>Image facts</label></div>
      <dl class="kv">
        <dt>mime</dt><dd>{{ facts.mime }}</dd>
        <dt>dimensions</dt><dd>{{ facts.width }} × {{ facts.height }} px</dd>
        <dt>pixels</dt><dd>{{ facts.pixels.toLocaleString() }}</dd>
        <dt>source bytes</dt><dd>{{ facts.approxBytes.toLocaleString() }}</dd>
        <dt>base64 length</dt><dd>{{ facts.base64Chars.toLocaleString() }} chars</dd>
      </dl>
    </div>

    <div v-if="previewUrl" class="pane">
      <div class="pane-label"><label>Preview</label></div>
      <img :src="previewUrl" :alt="facts ? `Preview of the uploaded ${facts.mime} image` : 'Preview'" style="max-width: 100%; max-height: 40vh; border-radius: var(--radius-sm); border: 1px solid var(--line)" />
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="b64i-in">Data URL</label>
        <button class="btn" type="button" @click="copy()" :disabled="!dataUrl">Copy</button>
      </div>
      <textarea id="b64i-in" v-model="dataUrl" class="auto-height" spellcheck="false" placeholder="data:image/png;base64,…" style="min-height: 90px"></textarea>
      <span v-if="note" class="badge">{{ note }}</span>
    </div>

    <div v-if="decodeUrl" class="pane">
      <div class="pane-label"><label>Decoded from data URL</label></div>
      <img :src="decodeUrl" alt="Image decoded from the pasted data URL" style="max-width: 100%; max-height: 40vh; border-radius: var(--radius-sm); border: 1px solid var(--line)" />
    </div>
  </section>
</template>
