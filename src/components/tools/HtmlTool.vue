<script setup lang="ts">
import { ref } from 'vue'
import { decodeHtml, encodeHtml } from '@/tools/html'
import { copyText } from '@/lib/clipboard'

const input = ref('')
const output = ref('')
const encodeNonAscii = ref(false)
const note = ref('')

function run(direction: 'encode' | 'decode'): void {
  note.value = ''
  output.value = direction === 'encode' ? encodeHtml(input.value, encodeNonAscii.value) : decodeHtml(input.value)
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
      <h1>HTML Encoder / Decoder</h1>
      <p>Escape the five structural characters (or all non-ASCII) and decode named plus numeric entities. Pure text transforms — your input is never rendered as HTML.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="html-in">Input</label>
        <span>{{ input.length.toLocaleString() }} chars</span>
      </div>
      <textarea id="html-in" v-model="input" spellcheck="false" placeholder="<a href=&quot;x&quot;> café 🙂"></textarea>
    </div>

    <div class="row">
      <button class="btn primary" type="button" :disabled="!input" @click="run('encode')">Encode →</button>
      <button class="btn" type="button" :disabled="!input" @click="run('decode')">← Decode</button>
      <button class="btn" type="button" @click="swap" :disabled="!output">Swap output in</button>
      <label class="field"><input v-model="encodeNonAscii" type="checkbox" /> Encode non-ASCII as numeric refs</label>
    </div>

    <div v-if="output" class="pane">
      <div class="pane-label">
        <label for="html-out">Output</label>
        <button class="btn" type="button" @click="copy()">Copy</button>
      </div>
      <textarea id="html-out" class="auto-height" readonly :value="output"></textarea>
      <span v-if="note" class="badge">{{ note }}</span>
    </div>

    <p class="msg dim">Decoding covers the HTML&nbsp;4 named entities and all numeric references; HTML5's extra aliases (e.g. <code>&amp;colon;</code>) are not supported and stay literal.</p>
  </section>
</template>
