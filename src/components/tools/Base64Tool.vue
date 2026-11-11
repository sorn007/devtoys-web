<script setup lang="ts">
import { ref } from 'vue'
import { useToolRunner } from '@/lib/useToolRunner'
import { copyText } from '@/lib/clipboard'

const { run, busy } = useToolRunner()

const input = ref('')
const output = ref('')
const urlSafe = ref(false)
const error = ref<string | null>(null)
const note = ref('')

async function encode(): Promise<void> {
  error.value = ''
  note.value = ''
  try {
    output.value = await run<string>(input.value.length, 'base64-encode', { input: input.value, urlSafe: urlSafe.value })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    output.value = ''
  }
}

async function decode(): Promise<void> {
  error.value = ''
  note.value = ''
  try {
    output.value = await run<string>(input.value.length, 'base64-decode', { input: input.value })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    output.value = ''
  }
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
      <h1>Base64 Encoder / Decoder</h1>
      <p>UTF-8 safe, both directions. URL-safe alphabet (- and _) accepted on decode.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="b64-in">Input</label>
        <span>{{ input.length.toLocaleString() }} chars</span>
      </div>
      <textarea id="b64-in" v-model="input" spellcheck="false" placeholder="Text or Base64…"></textarea>
    </div>

    <div class="row">
      <button class="btn primary" type="button" :disabled="busy || !input" @click="encode()">Encode →</button>
      <button class="btn" type="button" :disabled="busy || !input" @click="decode()">← Decode</button>
      <button class="btn" type="button" @click="swap" :disabled="!output">Swap output in</button>
      <label class="field"><input v-model="urlSafe" type="checkbox" /> URL-safe encode</label>
    </div>

    <p v-if="error" class="msg bad">{{ error }}</p>

    <div v-if="output" class="pane">
      <div class="pane-label">
        <label for="b64-out">Output</label>
        <button class="btn" type="button" @click="copy()">Copy</button>
      </div>
      <textarea id="b64-out" readonly :value="output"></textarea>
      <span v-if="note" class="badge">{{ note }}</span>
    </div>
  </section>
</template>
