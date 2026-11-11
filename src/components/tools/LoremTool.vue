<script setup lang="ts">
import { ref } from 'vue'
import { generateLorem, LOREM_MAX } from '@/tools/lorem'
import { copyText } from '@/lib/clipboard'

const mode = ref<'words' | 'sentences' | 'paragraphs'>('paragraphs')
const count = ref(3)
const classic = ref(true)
const output = ref('')
const note = ref('')

function generate(): void {
  const n = Math.max(1, Math.min(Math.floor(count.value) || 1, LOREM_MAX))
  count.value = n
  output.value = generateLorem({ [mode.value]: n, startWithClassic: classic.value } as Parameters<typeof generateLorem>[0])
}

async function copy(): Promise<void> {
  note.value = await copyText(output.value)
}

generate()
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>Lorem Ipsum Generator</h1>
      <p>Deterministic filler text by word, sentence or paragraph count (capped at {{ LOREM_MAX }}).</p>
    </div>

    <div class="row">
      <label class="field">
        Unit
        <select v-model="mode" style="width: auto">
          <option value="words">words</option>
          <option value="sentences">sentences</option>
          <option value="paragraphs">paragraphs</option>
        </select>
      </label>
      <label class="field">
        Count
        <input v-model.number="count" type="number" min="1" :max="LOREM_MAX" style="width: 90px" />
      </label>
      <label class="field"><input v-model="classic" type="checkbox" /> Start with the classic phrase</label>
      <button class="btn primary" type="button" @click="generate()">Generate</button>
      <button class="btn" type="button" @click="output = ''" :disabled="!output">Clear</button>
    </div>

    <div v-if="output" class="pane">
      <div class="pane-label">
        <label for="lorem-out">Output</label>
        <button class="btn" type="button" @click="copy()">Copy</button>
      </div>
      <textarea id="lorem-out" readonly :value="output" rows="10"></textarea>
      <span v-if="note" class="badge">{{ note }}</span>
    </div>
  </section>
</template>
