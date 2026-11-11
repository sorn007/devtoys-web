<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToolRunner } from '@/lib/useToolRunner'
import { parseUrl, type ParsedUrl } from '@/tools/url'
import { copyText } from '@/lib/clipboard'

const { run, busy } = useToolRunner()

const input = ref('')
const output = ref('')
const mode = ref<'component' | 'full'>('component')
const plusAsSpace = ref(false)
const error = ref<string | null>(null)
const note = ref('')

const parsed = computed<ParsedUrl>(() => parseUrl(input.value))

async function encode(): Promise<void> {
  error.value = null
  try {
    output.value = await run<string>(input.value.length, 'url-encode', { input: input.value, mode: mode.value })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

async function decode(): Promise<void> {
  error.value = null
  try {
    output.value = await run<string>(input.value.length, 'url-decode', { input: input.value, plusAsSpace: plusAsSpace.value })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

function swap(): void {
  if (!output.value) return
  input.value = output.value
  output.value = ''
}

async function copyOut(): Promise<void> {
  note.value = await copyText(output.value)
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>URL Encoder / Decoder</h1>
      <p>Percent-encode, percent-decode, and inspect a URL's parts and query parameters.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="url-in">Input</label>
        <span>{{ input.length.toLocaleString() }} chars</span>
      </div>
      <textarea id="url-in" v-model="input" spellcheck="false" placeholder="https://example.com/search?q=hello%20world"></textarea>
    </div>

    <div class="row">
      <button class="btn primary" type="button" :disabled="busy || !input" @click="encode()">Encode →</button>
      <button class="btn" type="button" :disabled="busy || !input" @click="decode()">← Decode</button>
      <button class="btn" type="button" @click="swap" :disabled="!output">Swap output in</button>
      <label class="field">
        Encode mode
        <select v-model="mode" style="width: auto">
          <option value="component">component (strict)</option>
          <option value="full">full URL (keeps ://&amp;=)</option>
        </select>
      </label>
      <label class="field"><input v-model="plusAsSpace" type="checkbox" /> <code>+</code> as space on decode</label>
    </div>

    <p v-if="error" class="msg bad">{{ error }}</p>

    <div v-if="output" class="pane">
      <div class="pane-label">
        <label for="url-out">Output</label>
        <button class="btn" type="button" @click="copyOut()">Copy</button>
      </div>
      <textarea id="url-out" readonly :value="output"></textarea>
      <span v-if="note" class="badge">{{ note }}</span>
    </div>

    <div v-if="input.trim() && parsed.ok" class="pane">
      <div class="pane-label"><label>URL parts</label></div>
      <dl class="kv">
        <template v-for="(value, key) in { protocol: parsed.protocol, host: parsed.hostname, port: parsed.port, path: parsed.pathname, query: parsed.search, fragment: parsed.hash, user: parsed.username }" :key="key">
          <dt>{{ key }}</dt>
          <dd>{{ value || '—' }}</dd>
        </template>
      </dl>
      <div v-if="parsed.params.length" class="pane-label" style="margin-top: 8px">
        <label>Decoded query parameters</label>
      </div>
      <dl v-if="parsed.params.length" class="kv">
        <template v-for="p in parsed.params" :key="p.key + p.value">
          <dt>{{ p.key }}</dt>
          <dd>{{ p.value }}</dd>
        </template>
      </dl>
    </div>
    <p v-else-if="input.trim() && !parsed.ok" class="msg dim">{{ parsed.error }}</p>
  </section>
</template>
