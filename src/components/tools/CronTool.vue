<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useDedicatedWorker } from '@/lib/useDedicatedWorker'
import { CRON_MAX_RUNS, parseCron } from '@/tools/cron'

const { run, busy, cancel } = useDedicatedWorker(
  () => new Worker(new URL('../../workers/cronWorker.ts', import.meta.url), { type: 'module' }),
)

const expression = ref('*/15 9-17 * * 1-5')
const count = ref(5)
const timeZone = ref(Intl.DateTimeFormat().resolvedOptions().timeZone)
const zones = ref<string[]>([Intl.DateTimeFormat().resolvedOptions().timeZone])
const fields = ref<string[]>([])
const runs = ref<string[]>([])
const exhausted = ref(false)
const error = ref<string | null>(null)

onMounted(() => {
  // A short, honest list: the user's zone, UTC, and a few common ones.
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone
  zones.value = [...new Set([local, 'UTC', 'America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney'])]
  timeZone.value = local
  void evaluate()
})

function quickCheck(): string | null {
  try {
    parseCron(expression.value)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

async function evaluate(): Promise<void> {
  error.value = exhausted.value ? null : error.value
  error.value = quickCheck()
  if (error.value) {
    fields.value = []
    runs.value = []
    return
  }
  try {
    const r = await run<{ fields: string[]; runs: string[]; exhausted: boolean }>('cron-evaluate', {
      expression: expression.value,
      count: count.value,
      timeZone: timeZone.value,
    })
    fields.value = r.fields
    runs.value = r.runs
    exhausted.value = r.exhausted
    if (r.exhausted && r.runs.length === 0) error.value = 'No occurrence found within the search window (the search is bounded; the expression may match nothing).'
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>Cron Parser</h1>
      <p>Validate 5- or 6-field cron expressions (with @daily-style macros), read them in plain English, and see the next runs in a chosen timezone.</p>
    </div>

    <div class="row grow">
      <input v-model="expression" type="text" spellcheck="false" aria-label="Cron expression" @input="evaluate()" />
      <button v-if="busy" class="btn" type="button" @click="cancel()">Cancel</button>
    </div>

    <div class="row">
      <label class="field">
        Runs to show
        <input v-model.number="count" type="number" min="1" :max="CRON_MAX_RUNS" style="width: 80px" @change="evaluate()" />
      </label>
      <label class="field">
        Timezone
        <select v-model="timeZone" style="width: auto" @change="evaluate()">
          <option v-for="z in zones" :key="z" :value="z">{{ z }}</option>
        </select>
      </label>
      <span v-if="busy" class="badge">scanning in a worker…</span>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>
    <p v-else-if="exhausted" class="msg dim" role="status">Search window reached before finding all runs; showing what was found.</p>

    <div v-if="fields.length" class="pane">
      <div class="pane-label"><label>In plain English</label></div>
      <ul class="cron-fields">
        <li v-for="f in fields" :key="f">{{ f }}</li>
      </ul>
    </div>

    <div v-if="runs.length" class="pane">
      <div class="pane-label"><label>Next {{ runs.length }} run{{ runs.length === 1 ? '' : 's' }} ({{ timeZone }})</label></div>
      <div class="list-box">
        <div v-for="(r, i) in runs" :key="i">
          {{ new Date(r).toLocaleString(undefined, { timeZone, dateStyle: 'medium', timeStyle: 'medium' }) }}
          <span class="dim"> · {{ r }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
