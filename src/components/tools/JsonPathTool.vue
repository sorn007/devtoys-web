<script setup lang="ts">
import { ref } from 'vue'
import { useDedicatedWorker } from '@/lib/useDedicatedWorker'
import type { JsonPathResult } from '@/tools/jsonpath'
import { JSONPATH_MAX_RESULTS } from '@/tools/jsonpath'

const { run, busy, cancel } = useDedicatedWorker(
  () => new Worker(new URL('../../workers/jsonpathWorker.ts', import.meta.url), { type: 'module' }),
)

const query = ref('$.store.book[?(@.price < 10)].title')
const input = ref('')
const result = ref<JsonPathResult | null>(null)
const error = ref<string | null>(null)

async function evaluate(): Promise<void> {
  if (!input.value.trim() || !query.value.trim()) {
    result.value = null
    return
  }
  try {
    const r = await run<JsonPathResult>('jsonpath-run', { query: query.value, input: input.value })
    result.value = r
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

function preview(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>JSONPath Tester</h1>
      <p>A safe, in-house JSONPath engine — no eval and no code generation from your query. Runs in a worker with a time cap.</p>
    </div>

    <div class="row grow">
      <input v-model="query" type="text" spellcheck="false" aria-label="JSONPath expression" @input="evaluate()" />
      <button v-if="busy" class="btn" type="button" @click="cancel()">Cancel</button>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="jp-in">JSON</label>
        <span>{{ input.length.toLocaleString() }} chars</span>
      </div>
      <textarea id="jp-in" v-model="input" spellcheck="false" style="min-height: 170px" placeholder='{"store":{"book":[{"title":"A","price":8.95},{"title":"B","price":22}]}}' @input="evaluate()"></textarea>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>
    <p v-else-if="result && !result.ok" class="msg bad" role="alert">{{ result.error }}</p>

    <template v-if="result?.ok">
      <div class="row">
        <span class="badge" :class="result.count ? 'ok' : ''">{{ result.count }} match{{ result.count === 1 ? '' : 'es' }}</span>
        <span v-if="result.truncated" class="badge warn">capped at {{ JSONPATH_MAX_RESULTS.toLocaleString() }} results</span>
      </div>
      <div v-if="result.matches.length" class="list-box">
        <div v-for="(m, i) in result.matches" :key="i">
          <span class="dim">{{ m.path }}</span> → {{ preview(m.value) }}
        </div>
      </div>
      <p v-else class="msg dim">No matches. Supported: <code>$.a.b</code>, <code>..name</code>, <code>[*]</code>, <code>[2]</code>, <code>[-1]</code>, <code>[0,2]</code>, <code>[1:9:2]</code>, <code>[?(@.price &lt; 10)]</code> with <code>== != &lt; &lt;= &gt; &gt;= =~ /re/ &amp;&amp; || !</code>. Script expressions like <code>[(@.length-1)]</code> are rejected on purpose — they require evaluating code.</p>
    </template>
  </section>
</template>
