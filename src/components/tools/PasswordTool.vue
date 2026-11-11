<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CHAR_CLASSES,
  entropyBits,
  generateBatch,
  strengthBand,
  type CharClass,
} from '@/tools/password'
import { PASSWORD_MAX_BATCH } from '@/lib/limits'
import { copyText } from '@/lib/clipboard'

const length = ref(20)
const count = ref(1)
const requireEach = ref(true)
const excludeAmbiguous = ref(true)
const selected = ref<Set<CharClass>>(new Set<CharClass>(CHAR_CLASSES))
const output = ref('')
const error = ref<string | null>(null)
const note = ref('')

const classes = computed<CharClass[]>(() => CHAR_CLASSES.filter((c) => selected.value.has(c)))

const entropy = computed(() => {
  if (classes.value.length === 0) return 0
  try {
    return entropyBits({ length: length.value, classes: classes.value, excludeAmbiguous: excludeAmbiguous.value })
  } catch {
    return 0
  }
})
const band = computed(() => strengthBand(entropy.value))

function toggle(cls: CharClass): void {
  const next = new Set(selected.value)
  if (next.has(cls)) next.delete(cls)
  else next.add(cls)
  selected.value = next
}

function generate(): void {
  error.value = null
  note.value = ''
  try {
    output.value = generateBatch(
      { length: length.value, classes: classes.value, requireEach: requireEach.value, excludeAmbiguous: excludeAmbiguous.value },
      count.value,
    ).join('\n')
  } catch (err) {
    output.value = ''
    error.value = err instanceof Error ? err.message : String(err)
  }
}

async function copy(): Promise<void> {
  note.value = await copyText(output.value)
}

generate()
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>Password Generator</h1>
      <p>Cryptographically random (crypto.getRandomValues, unbiased sampling). Strength is an entropy heuristic, not a guarantee.</p>
    </div>

    <div class="row">
      <label class="field">Length <input v-model.number="length" type="number" min="4" max="256" style="width: 80px" /></label>
      <label class="field">Count <input v-model.number="count" type="number" min="1" :max="PASSWORD_MAX_BATCH" style="width: 80px" /></label>
      <label class="field"><input v-model="requireEach" type="checkbox" /> One of each class</label>
      <label class="field"><input v-model="excludeAmbiguous" type="checkbox" /> Exclude look-alikes</label>
    </div>

    <div class="chips">
      <button
        v-for="cls in CHAR_CLASSES"
        :key="cls"
        class="chip"
        :class="{ on: selected.has(cls) }"
        type="button"
        @click="toggle(cls)"
      >
        {{ cls }}
      </button>
    </div>

    <div class="row">
      <button class="btn primary" type="button" @click="generate()">Generate</button>
      <button class="btn" type="button" @click="copy()" :disabled="!output">Copy</button>
      <span class="badge" :class="band === 'weak' ? 'bad' : band === 'fair' ? 'warn' : 'ok'">
        ~{{ entropy }} bits · {{ band }}
      </span>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>

    <div v-if="output" class="pane">
      <div class="pane-label"><label for="pw-out">{{ output.split('\n').length }} password{{ output.includes('\n') ? 's' : '' }}</label></div>
      <textarea id="pw-out" readonly :value="output" :rows="Math.min(output.split('\n').length, 12)" class="pw"></textarea>
      <span v-if="note" class="badge">{{ note }}</span>
    </div>
  </section>
</template>
