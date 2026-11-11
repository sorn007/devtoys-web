<script setup lang="ts">
import { computed, ref } from 'vue'
import { describeDate, exceedsSafeInteger, parseDateInput, type DateFacts } from '@/tools/date'
import { copyText } from '@/lib/clipboard'

const input = ref('')
const now = () => {
  input.value = String(Date.now())
  parse()
}

const parsed = ref<ReturnType<typeof parseDateInput> | null>(null)
const facts = ref<DateFacts | null>(null)
const error = ref<string | null>(null)
const note = ref('')
const unsafe = computed(() => input.value.trim() !== '' && exceedsSafeInteger(input.value))

const KIND_LABEL: Record<string, string> = {
  'unix-seconds': 'Unix seconds',
  'unix-millis': 'Unix milliseconds',
  'unix-micros': 'Unix microseconds',
  'dotnet-ticks': '.NET ticks (100 ns)',
  'iso-8601': 'Calendar date / ISO 8601',
  unknown: '—',
}

function parse(): void {
  error.value = null
  facts.value = null
  const result = parseDateInput(input.value)
  parsed.value = result
  if (!result.ok) {
    error.value = result.error
    return
  }
  try {
    facts.value = describeDate(result.millis, result.microsRemainder)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

const rows = computed(() => {
  const f = facts.value
  if (!f) return [] as { key: string; value: string }[]
  return [
    { key: 'ISO 8601 (UTC)', value: f.isoUtc },
    { key: 'ISO 8601 (local)', value: f.isoLocal },
    { key: 'RFC 1122/2822', value: f.rfc2822 },
    { key: 'Unix seconds', value: f.unixSeconds },
    { key: 'Unix milliseconds', value: f.unixMillis },
    { key: 'Unix microseconds', value: f.unixMicros },
    { key: '.NET ticks', value: f.dotnetTicks },
    { key: 'Weekday (local)', value: f.weekday },
  ]
})

async function copy(value: string): Promise<void> {
  note.value = await copyText(value)
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>Date Converter</h1>
      <p>Paste a Unix timestamp (s, ms, µs), .NET ticks, or a calendar date; every representation updates together.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="date-in">Input</label>
        <span v-if="parsed?.ok" class="badge">detected: {{ KIND_LABEL[parsed.kind] }}</span>
        <span v-else-if="unsafe" class="badge warn">beyond 2^53 — handled with BigInt</span>
      </div>
      <div class="row grow">
        <input
          id="date-in"
          v-model="input"
          type="text"
          spellcheck="false"
          placeholder="1770000000 · 1770000000000 · 2026-11-10T12:00:00Z"
          @input="parse"
        />
        <button class="btn" type="button" @click="now()">Now</button>
        <button class="btn" type="button" @click="input = ''; parse()" :disabled="!input">Clear</button>
      </div>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>

    <div v-if="facts" class="pane">
      <div class="pane-label"><label>Conversions</label><span v-if="note" class="badge">{{ note }}</span></div>
      <dl class="kv">
        <template v-for="row in rows" :key="row.key">
          <dt>{{ row.key }}</dt>
          <dd>
            <button class="kv-copy" type="button" :title="'Copy ' + row.key" @click="copy(row.value)">{{ row.value }}</button>
          </dd>
        </template>
      </dl>
      <p class="msg dim">Precision note: microsecond and tick inputs are computed in BigInt; sub-millisecond remainders are preserved where the target format allows.</p>
    </div>
  </section>
</template>
