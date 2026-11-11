<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToolRunner } from '@/lib/useToolRunner'
import { byteSize, type JsonFormatResult } from '@/tools/json'
import { copyText } from '@/lib/clipboard'

const { run, busy } = useToolRunner()

const input = ref('')
const indent = ref(2)
const sortKeys = ref(false)
const result = ref<JsonFormatResult | null>(null)
const error = ref<string | null>(null)

const stats = computed(() =>
  result.value
    ? `${result.value.charLength.toLocaleString()} chars · ${result.value.byteLength.toLocaleString()} bytes UTF-8`
    : `${input.value.length.toLocaleString()} chars · ${byteSize(input.value).toLocaleString()} bytes UTF-8`,
)

async function format(minify: boolean): Promise<void> {
  error.value = null
  try {
    result.value = await run<JsonFormatResult>(
      input.value.length,
      minify ? 'json-minify' : 'json-format',
      { input: input.value, indent: indent.value, sortKeys: sortKeys.value },
    )
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    result.value = null
  }
}

function swap(): void {
  if (result.value?.output) {
    input.value = result.value.output
    result.value = null
  }
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>JSON Formatter &amp; Validator</h1>
      <p>Pretty-print or minify JSON, with the exact line and column of any syntax error.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="json-in">Input</label>
        <span>{{ stats }}</span>
      </div>
      <textarea
        id="json-in"
        v-model="input"
        spellcheck="false"
        placeholder='{"hello":"world"}'
        @paste="format(false)"
      ></textarea>
    </div>

    <div class="row">
      <button class="btn primary" type="button" :disabled="busy" @click="format(false)">Format</button>
      <button class="btn" type="button" :disabled="busy" @click="format(true)">Minify</button>
      <button class="btn" type="button" @click="swap" :disabled="!result?.output">Use output as input</button>
      <label class="field">
        Indent
        <select v-model.number="indent" style="width: auto">
          <option :value="2">2 spaces</option>
          <option :value="4">4 spaces</option>
          <option :value="0">minified</option>
        </select>
      </label>
      <label class="field"><input v-model="sortKeys" type="checkbox" /> Sort keys</label>
    </div>

    <p v-if="error" class="msg bad">{{ error }}</p>
    <p v-else-if="result && !result.ok" class="msg bad">
      <template v-if="result.line">Line {{ result.line }}, column {{ result.column }}: </template>{{ result.error }}
    </p>
    <p v-else-if="result?.ok" class="msg ok">Valid JSON.</p>

    <div v-if="result?.output" class="pane">
      <div class="pane-label">
        <label for="json-out">Output</label>
        <button class="btn" type="button" @click="copyText(result!.output, 'Copied.')">Copy</button>
      </div>
      <textarea
        id="json-out"
        class="auto-height"
        readonly
        :value="result.output"
        :rows="Math.min(Math.max(result.output.split('\n').length, 3), 24)"
        style="min-height: 96px"
      ></textarea>
    </div>
  </section>
</template>
