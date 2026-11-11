<script setup lang="ts">
import { ref } from 'vue'
import { validateXml } from '@/tools/xml'
import { copyText } from '@/lib/clipboard'

const input = ref('')
const error = ref<string | null>(null)
const formatted = ref('')
const minified = ref('')
const stats = ref('')
const note = ref('')

function run(): void {
  note.value = ''
  error.value = null
  formatted.value = ''
  minified.value = ''
  try {
    const r = validateXml(input.value)
    if (!r.ok) {
      error.value = r.error
      return
    }
    formatted.value = r.formatted
    minified.value = r.minified
    stats.value = `well-formed · ${r.elements.toLocaleString()} elements · max depth ${r.maxDepth}`
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

async function copy(text: string): Promise<void> {
  note.value = await copyText(text)
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>XML Formatter &amp; Validator</h1>
      <p>Well-formedness check and pretty/minify output. DOCTYPEs, DTDs and entity declarations are rejected outright.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="xml-in">XML</label>
        <span>{{ input.length.toLocaleString() }} chars</span>
      </div>
      <textarea id="xml-in" v-model="input" spellcheck="false" placeholder='<root><item id="1"/></root>' @input="run()"></textarea>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>
    <p v-else-if="stats" class="msg ok">{{ stats }}</p>

    <div v-if="formatted" class="pane">
      <div class="pane-label">
        <label for="xml-out">Formatted</label>
        <span>
          <button class="btn" type="button" @click="copy(formatted)">Copy</button>
          <button class="btn" type="button" @click="input = minified; run()">Use minified as input</button>
          <span v-if="note" class="badge">{{ note }}</span>
        </span>
      </div>
      <textarea id="xml-out" class="auto-height" readonly :value="formatted" :rows="Math.min(Math.max(formatted.split('\n').length, 3), 24)"></textarea>
    </div>
  </section>
</template>
