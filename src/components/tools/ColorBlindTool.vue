<script setup lang="ts">
import { ref } from 'vue'
import { useDedicatedWorker } from '@/lib/useDedicatedWorker'
import { useObjectUrls } from '@/lib/objectUrls'
import { CVD_LABELS, CVD_TYPES, type CvdType } from '@/tools/colorblind'

const { run, busy, cancel } = useDedicatedWorker(
  () => new Worker(new URL('../../workers/imageWorker.ts', import.meta.url), { type: 'module' }),
)
const urls = useObjectUrls()

const type = ref<CvdType>('deutan')
const severity = ref(1)
const sourceUrl = ref('')
const resultUrl = ref('')
const dims = ref('')
const error = ref<string | null>(null)
let bytes: Uint8Array | null = null

async function onFile(event: Event): Promise<void> {
  error.value = null
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  bytes = new Uint8Array(await file.arrayBuffer())
  clearResult()
  sourceUrl.value = urls.create(new Blob([bytes as unknown as BlobPart], { type: file.type || 'image/png' }))
  dims.value = file.type || 'image/png'
  void simulate()
}

async function simulate(): Promise<void> {
  if (!bytes) return
  error.value = null
  clearResult()
  try {
    const r = await run<{ blob: Uint8Array; mime: string }>('cvd-simulate', {
      data: bytes,
      type: type.value,
      severity: severity.value,
    })
    resultUrl.value = urls.create(new Blob([r.blob as unknown as BlobPart], { type: r.mime }))
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

function clearResult(): void {
  if (resultUrl.value) {
    urls.revoke(resultUrl.value)
    resultUrl.value = ''
  }
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>Colour Blindness Simulator</h1>
      <p>Simulate protanopia, deuteranopia, tritanopia and achromatopsia on an image, at adjustable severity. Images are capped at 40 million pixels / 12,000 px per side before decoding.</p>
    </div>

    <div class="row">
      <label class="field">
        Type
        <select v-model="type" style="width: auto" @change="simulate()">
          <option v-for="t in CVD_TYPES" :key="t" :value="t">{{ CVD_LABELS[t] }}</option>
        </select>
      </label>
      <label class="field">
        Severity {{ severity.toFixed(2) }}
        <input v-model.number="severity" type="range" min="0" max="1" step="0.05" style="width: 140px" @input="simulate()" />
      </label>
      <label class="field">
        Image
        <input type="file" accept="image/*" @change="onFile" />
      </label>
      <button v-if="busy" class="btn" type="button" @click="cancel()">Cancel</button>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>
    <p v-if="busy" class="msg dim">Simulating in a background worker…</p>

    <div v-if="sourceUrl || resultUrl" class="row" style="align-items: flex-start">
      <figure v-if="sourceUrl" class="cvd-fig">
        <img :src="sourceUrl" alt="Original image" />
        <figcaption>Original ({{ dims }})</figcaption>
      </figure>
      <figure v-if="resultUrl" class="cvd-fig">
        <img :src="resultUrl" :alt="`Image as seen with ${CVD_LABELS[type]}`" />
        <figcaption>{{ CVD_LABELS[type] }} · severity {{ severity.toFixed(2) }}</figcaption>
      </figure>
    </div>
    <a v-if="resultUrl" class="btn" :href="resultUrl" :download="`simulated-${type}.png`">Download simulated PNG</a>
  </section>
</template>
