<script setup lang="ts">
import { ref } from 'vue'
import { useDedicatedWorker } from '@/lib/useDedicatedWorker'
import { useObjectUrls } from '@/lib/objectUrls'
import { GZIP_MAX_OUTPUT_BYTES } from '@/lib/limits'

const { run, busy, cancel } = useDedicatedWorker(
  () => new Worker(new URL('../../workers/gzipWorker.ts', import.meta.url), { type: 'module' }),
)
const urls = useObjectUrls()

const input = ref('')
const output = ref('')
const stats = ref('')
const error = ref<string | null>(null)
const downloadUrl = ref('')

async function compress(): Promise<void> {
  error.value = null
  clearDownload()
  try {
    const data = new TextEncoder().encode(input.value)
    const r = await run<{ data: Uint8Array; bytes: number }>('gzip-compress', { data })
    output.value = `${r.bytes.toLocaleString()} bytes of gzip — download below or decompress it back.`
    stats.value = `${data.byteLength.toLocaleString()} bytes → ${r.bytes.toLocaleString()} bytes (${ratio(data.byteLength, r.bytes)})`
    const blob = new Blob([r.data as unknown as BlobPart], { type: 'application/gzip' })
    downloadUrl.value = urls.create(blob)
  } catch (err) {
    fail(err)
  }
}

async function decompress(): Promise<void> {
  error.value = null
  clearDownload()
  try {
    // Accepts a file (below) or base64/none — the paste path expects a .gz file.
    if (!fileBytes) {
      error.value = 'Choose a .gz file to decompress (paste-to-decompress is not offered because gzip bytes are not text).'
      return
    }
    const r = await run<{ text: string; bytes: number }>('gzip-decompress', { data: fileBytes })
    output.value = r.text
    stats.value = `${fileBytes.byteLength.toLocaleString()} bytes → ${r.bytes.toLocaleString()} bytes (${ratio(fileBytes.byteLength, r.bytes)})`
  } catch (err) {
    fail(err)
  }
}

let fileBytes: Uint8Array | null = null
async function onFile(event: Event): Promise<void> {
  error.value = null
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  fileBytes = new Uint8Array(await file.arrayBuffer())
  stats.value = `${file.name} · ${fileBytes.byteLength.toLocaleString()} bytes`
}

function clearDownload(): void {
  if (downloadUrl.value) {
    urls.revoke(downloadUrl.value)
    downloadUrl.value = ''
  }
}

function fail(err: unknown): void {
  output.value = ''
  stats.value = ''
  error.value = err instanceof Error ? err.message : String(err)
}

function ratio(before: number, after: number): string {
  return before === 0 ? 'n/a' : `${Math.max(1, Math.round(before / Math.max(after, 1)))}× smaller`
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>GZIP Compress / Decompress</h1>
      <p>Native streaming compression, pako fallback. Decompression is output-capped at {{ (GZIP_MAX_OUTPUT_BYTES / 1048576).toFixed(0) }} MiB so a compression bomb cannot exhaust memory.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="gz-in">Text to compress</label>
        <span>{{ input.length.toLocaleString() }} chars</span>
      </div>
      <textarea id="gz-in" v-model="input" spellcheck="false" placeholder="Paste text to compress…"></textarea>
    </div>

    <div class="row">
      <button class="btn primary" type="button" :disabled="!input || busy" @click="compress()">Compress → .gz</button>
      <a v-if="downloadUrl" class="btn" :href="downloadUrl" download="compressed.gz">Download .gz</a>
      <label class="field">
        Or pick a .gz to decompress
        <input type="file" accept=".gz,application/gzip" @change="onFile" />
      </label>
      <button class="btn" type="button" :disabled="!fileBytes || busy" @click="decompress()">← Decompress</button>
      <button v-if="busy" class="btn" type="button" @click="cancel()">Cancel</button>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>
    <p v-if="stats" class="msg dim">{{ stats }}</p>

    <div v-if="output && !downloadUrl" class="pane">
      <div class="pane-label"><label for="gz-out">Decompressed text</label></div>
      <textarea id="gz-out" class="auto-height" readonly :value="output"></textarea>
    </div>
  </section>
</template>
