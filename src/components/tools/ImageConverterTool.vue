<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDedicatedWorker } from '@/lib/useDedicatedWorker'
import { useObjectUrls } from '@/lib/objectUrls'
import { canEncode, clampQuality, CONVERT_FORMATS, DECODE_DISCLOSURE, type ImageFormat } from '@/tools/imgconvert'

const { run, busy, cancel } = useDedicatedWorker(
  () => new Worker(new URL('../../workers/imageWorker.ts', import.meta.url), { type: 'module' }),
)
const urls = useObjectUrls()

type QueueItem = { name: string; bytes: Uint8Array; type: string }
type Result = { name: string; url: string; mime: string; before: number; after: number; width: number; height: number }

const format = ref<ImageFormat>('webp')
const quality = ref(0.92)
const results = ref<Result[]>([])
const error = ref<string | null>(null)
const supported = ref<Record<string, boolean>>({})
const progress = ref('')

onMounted(async () => {
  // Report only what this browser can actually encode.
  const entries = await Promise.all(CONVERT_FORMATS.map(async (f) => [f.id, await canEncode(f.id)] as const))
  supported.value = Object.fromEntries(entries)
})

async function onFiles(event: Event): Promise<void> {
  error.value = null
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  if (files.length === 0) return
  clearResults()
  const queue: QueueItem[] = []
  for (const file of files) {
    queue.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()), type: file.type })
  }
  // Sequential, not Promise.all: one decoded bitmap in memory at a time.
  for (const item of queue) {
    progress.value = `Converting ${item.name}…`
    try {
      const r = await run<{ blob: Uint8Array; mime: string; width: number; height: number }>('image-convert', {
        data: item.bytes,
        format: format.value,
        quality: clampQuality(quality.value),
      })
      results.value.push({
        name: item.name.replace(/\.[^.]+$/, '') + '.' + r.mime.split('/')[1],
        url: urls.create(new Blob([r.blob as unknown as BlobPart], { type: r.mime })),
        mime: r.mime,
        before: item.bytes.byteLength,
        after: r.blob.byteLength,
        width: r.width,
        height: r.height,
      })
    } catch (err) {
      error.value = `${item.name}: ${err instanceof Error ? err.message : String(err)}`
    }
  }
  progress.value = ''
}

function clearResults(): void {
  for (const r of results.value) urls.revoke(r.url)
  results.value = []
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>Image Converter</h1>
      <p>Convert to PNG, JPEG or WebP locally. Batches run one image at a time to keep memory bounded; images are capped at 40 million pixels / 12,000 px per side.</p>
    </div>

    <div class="row">
      <label class="field">
        Format
        <select v-model="format" style="width: auto">
          <option v-for="f in CONVERT_FORMATS" :key="f.id" :value="f.id" :disabled="supported[f.id] === false">
            {{ f.label }}{{ supported[f.id] === false ? ' — unsupported here' : '' }}
          </option>
        </select>
      </label>
      <label v-if="format !== 'png'" class="field">
        Quality {{ quality.toFixed(2) }}
        <input v-model.number="quality" type="range" min="0.5" max="1" step="0.01" style="width: 140px" />
      </label>
      <label class="field">
        Images
        <input type="file" accept="image/*" multiple @change="onFiles" />
      </label>
      <button v-if="busy" class="btn" type="button" @click="cancel()">Cancel</button>
    </div>

    <p class="msg dim">{{ DECODE_DISCLOSURE }}</p>
    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>
    <p v-if="progress" class="msg dim">{{ progress }}</p>

    <div v-if="results.length" class="pane">
      <div class="pane-label"><label>Converted ({{ results.length }})</label></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>File</th><th>Dimensions</th><th>Before</th><th>After</th><th>Save</th></tr></thead>
          <tbody>
            <tr v-for="r in results" :key="r.url">
              <td>{{ r.name }}</td>
              <td>{{ r.width }} × {{ r.height }}</td>
              <td>{{ r.before.toLocaleString() }} B</td>
              <td>{{ r.after.toLocaleString() }} B ({{ r.after <= r.before ? '−' : '+' }}{{ Math.abs(Math.round((1 - r.after / r.before) * 100)) }}%)</td>
              <td><a class="btn" :href="r.url" :download="r.name">Download</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
