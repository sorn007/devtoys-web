<script setup lang="ts">
import { ref } from 'vue'
import { uuidBatch, uuidv4, uuidv7, isUuid, UUID_MAX_BATCH } from '@/tools/uuid'
import { copyText } from '@/lib/clipboard'

const version = ref<4 | 7>(4)
const count = ref(5)
const uppercase = ref(false)
const braces = ref(false)
const output = ref('')
const note = ref('')
const checkInput = ref('')

/** Generated on the main thread: 500 CSPRNG draws cost well under a millisecond. */
function generate(): void {
  const n = Math.min(Math.max(1, Math.floor(count.value) || 1), UUID_MAX_BATCH)
  count.value = n
  output.value = uuidBatch(n, version.value, uppercase.value, braces.value).join('\n')
}

const single = () => output.value = (version.value === 4 ? uuidv4() : uuidv7(Date.now())) + '\n' + output.value

const checkVerdict = ref<null | boolean>(null)

async function copy(): Promise<void> {
  note.value = await copyText(output.value)
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>UUID Generator</h1>
      <p>Cryptographically random UUIDs (v4) and time-ordered UUIDs (v7), up to {{ UUID_MAX_BATCH }} per batch.</p>
    </div>

    <div class="row">
      <label class="field">
        Version
        <select v-model.number="version" style="width: auto">
          <option :value="4">v4 — random</option>
          <option :value="7">v7 — time-sortable</option>
        </select>
      </label>
      <label class="field">
        Count
        <input v-model.number="count" type="number" min="1" :max="UUID_MAX_BATCH" style="width: 90px" />
      </label>
      <label class="field"><input v-model="uppercase" type="checkbox" /> Uppercase</label>
      <label class="field"><input v-model="braces" type="checkbox" /> {braces}</label>
      <button class="btn primary" type="button" @click="generate()">Generate</button>
      <button class="btn" type="button" @click="single" :disabled="version !== 4 && version !== 7">+1</button>
      <button class="btn" type="button" @click="output = ''" :disabled="!output">Clear</button>
    </div>

    <div v-if="output" class="pane">
      <div class="pane-label">
        <label for="uuid-out">{{ output.split('\n').filter(Boolean).length }} UUIDs</label>
        <button class="btn" type="button" @click="copy()">Copy all</button>
      </div>
      <textarea id="uuid-out" readonly :value="output" rows="8"></textarea>
      <span v-if="note" class="badge">{{ note }}</span>
    </div>

    <div class="pane">
      <div class="pane-label"><label for="uuid-check">Validate an existing UUID</label></div>
      <div class="row grow">
        <input id="uuid-check" v-model="checkInput" type="text" spellcheck="false" placeholder="0b9a3c2d-…"
          @input="checkVerdict = checkInput.trim() === '' ? null : isUuid(checkInput)" />
        <span v-if="checkVerdict === true" class="badge ok">valid</span>
        <span v-else-if="checkVerdict === false" class="badge bad">not a valid UUID</span>
      </div>
    </div>
  </section>
</template>
