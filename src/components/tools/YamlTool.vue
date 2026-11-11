<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ConvertResult } from '@/tools/yamlx'
import { useDedicatedWorker } from '@/lib/useDedicatedWorker'
import { copyText } from '@/lib/clipboard'

// Dedicated worker entry: `yaml` never enters the shared worker or the shell.
const { run, busy, cancel } = useDedicatedWorker(
  () => new Worker(new URL('../../workers/yamlWorker.ts', import.meta.url), { type: 'module' }),
)

const input = ref('')
const output = ref('')
const error = ref<string | null>(null)
const note = ref('')
const direction = ref<'to-json' | 'to-yaml'>('to-yaml')

const placeholder = computed(() =>
  direction.value === 'to-yaml' ? '{"a": [1, 2]}' : 'a:\n  - 1\n  - 2',
)

async function convert(): Promise<void> {
  error.value = null
  note.value = ''
  try {
    const result = await run<ConvertResult>(
      direction.value === 'to-yaml' ? 'json-to-yaml' : 'yaml-to-json',
      { input: input.value },
    )
    if (result.ok) output.value = result.output
    else {
      output.value = ''
      error.value = result.error
    }
  } catch (err) {
    output.value = ''
    error.value = err instanceof Error ? err.message : String(err)
  }
}

function swap(): void {
  if (!output.value) return
  input.value = output.value
  output.value = ''
  direction.value = direction.value === 'to-yaml' ? 'to-json' : 'to-yaml'
}

async function copy(): Promise<void> {
  note.value = await copyText(output.value)
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>JSON &lt;&gt; YAML</h1>
      <p>Convert either way using the YAML 1.2 core schema. No JS tags, no arbitrary object construction, aliases bounded.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="yaml-in">Input ({{ direction === 'to-yaml' ? 'JSON' : 'YAML' }})</label>
        <span>{{ input.length.toLocaleString() }} chars</span>
      </div>
      <textarea id="yaml-in" v-model="input" spellcheck="false" :placeholder="placeholder"></textarea>
    </div>

    <div class="row">
      <button class="btn primary" type="button" :disabled="!input || busy" @click="convert()">
        {{ direction === 'to-yaml' ? 'JSON → YAML' : 'YAML → JSON' }}
      </button>
      <button v-if="busy" class="btn" type="button" @click="cancel()">Cancel</button>
      <button class="btn" type="button" @click="direction = direction === 'to-yaml' ? 'to-json' : 'to-yaml'">Swap direction</button>
      <button class="btn" type="button" @click="swap" :disabled="!output">Use output as input</button>
      <span v-if="busy" class="badge">working in a background worker…</span>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>

    <div v-if="output" class="pane">
      <div class="pane-label">
        <label for="yaml-out">Output</label>
        <button class="btn" type="button" @click="copy()">Copy</button>
      </div>
      <textarea id="yaml-out" class="auto-height" readonly :value="output" :rows="Math.min(Math.max(output.split('\n').length, 3), 24)"></textarea>
      <span v-if="note" class="badge">{{ note }}</span>
    </div>
  </section>
</template>
