<script setup lang="ts">
import { ref } from 'vue'
import { ESCAPE_TARGETS, escapeText, unescapeText, type EscapeTarget } from '@/tools/escape'
import { copyText } from '@/lib/clipboard'

const input = ref('')
const target = ref<EscapeTarget>('json')
const escapeNonAscii = ref(false)
const output = ref('')
const note = ref('')

function run(direction: 'escape' | 'unescape'): void {
  note.value = ''
  output.value =
    direction === 'escape'
      ? escapeText(input.value, target.value, escapeNonAscii.value)
      : unescapeText(input.value, target.value)
}

function swap(): void {
  if (!output.value) return
  input.value = output.value
  output.value = ''
}

async function copy(): Promise<void> {
  note.value = await copyText(output.value)
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>Escape / Unescape</h1>
      <p>String-literal and markup escaping for JSON, XML/HTML and JavaScript. Pure text transforms — nothing is evaluated.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="esc-in">Input</label>
        <span>{{ input.length.toLocaleString() }} chars</span>
      </div>
      <textarea id="esc-in" v-model="input" spellcheck="false" placeholder="Paste text with quotes, newlines or markup…"></textarea>
    </div>

    <div class="row">
      <button class="btn primary" type="button" :disabled="!input" @click="run('escape')">Escape →</button>
      <button class="btn" type="button" :disabled="!input" @click="run('unescape')">← Unescape</button>
      <button class="btn" type="button" @click="swap" :disabled="!output">Swap output in</button>
      <label class="field">
        Target
        <select v-model="target" style="width: auto">
          <option v-for="t in ESCAPE_TARGETS" :key="t.id" :value="t.id">{{ t.label }}</option>
        </select>
      </label>
      <label class="field"><input v-model="escapeNonAscii" type="checkbox" /> Escape non-ASCII as \u…</label>
    </div>

    <div v-if="output" class="pane">
      <div class="pane-label">
        <label for="esc-out">Output</label>
        <button class="btn" type="button" @click="copy()">Copy</button>
      </div>
      <textarea id="esc-out" readonly :value="output"></textarea>
      <span v-if="note" class="badge">{{ note }}</span>
    </div>
  </section>
</template>
