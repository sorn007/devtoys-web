<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDedicatedWorker } from '@/lib/useDedicatedWorker'
import type { SqlResult } from '@/tools/sql'
import { copyText } from '@/lib/clipboard'

// Dedicated worker entry: `sql-formatter` never enters the shared worker or the shell.
const { run, busy, cancel } = useDedicatedWorker(
  () => new Worker(new URL('../../workers/sqlWorker.ts', import.meta.url), { type: 'module' }),
)

const input = ref('select id, name from users where created_at > ' + "'2026-01-01' order by name")
const dialect = ref('sql')
const uppercaseKeywords = ref(true)
const dialects = ref<string[]>([])
const output = ref('')
const error = ref<string | null>(null)
const note = ref('')

onMounted(async () => {
  dialects.value = await run<string[]>('sql-dialects', {})
})

async function format(): Promise<void> {
  if (!input.value.trim() || busy.value) return
  error.value = null
  note.value = ''
  try {
    const result = await run<SqlResult>('sql-format', {
      input: input.value,
      dialect: dialect.value,
      uppercaseKeywords: uppercaseKeywords.value,
    })
    dialects.value = result.dialects
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
}

async function copy(): Promise<void> {
  note.value = await copyText(output.value)
}

void format()
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>SQL Formatter</h1>
      <p>Format SQL for the dialect you actually run. Dialects come from sql-formatter itself, so the list never lies.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="sql-in">SQL</label>
        <span>{{ input.length.toLocaleString() }} chars</span>
      </div>
      <textarea id="sql-in" v-model="input" spellcheck="false" @input="format()"></textarea>
    </div>

    <div class="row">
      <label class="field">
        Dialect
        <select v-model="dialect" style="width: auto" @change="format()">
          <option v-for="d in dialects" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>
      <label class="field"><input v-model="uppercaseKeywords" type="checkbox" @change="format()" /> Uppercase keywords</label>
      <button class="btn primary" type="button" :disabled="!input || busy" @click="format()">Format</button>
      <button v-if="busy" class="btn" type="button" @click="cancel()">Cancel</button>
      <button class="btn" type="button" @click="swap" :disabled="!output">Swap output in</button>
      <span v-if="busy" class="badge">working in a background worker…</span>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>

    <div v-if="output" class="pane">
      <div class="pane-label">
        <label for="sql-out">Formatted</label>
        <button class="btn" type="button" @click="copy()">Copy</button>
      </div>
      <textarea id="sql-out" class="auto-height" readonly :value="output" :rows="Math.min(Math.max(output.split('\n').length, 3), 24)"></textarea>
      <span v-if="note" class="badge">{{ note }}</span>
    </div>
  </section>
</template>
