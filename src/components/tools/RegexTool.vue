<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useToolRunner } from '@/lib/useToolRunner'
import { hasReDoSRisk, type RegexResult } from '@/tools/regex'

const { run } = useToolRunner()

const pattern = ref('')
const text = ref('')
const replacement = ref('')
const useReplacement = ref(false)
const flags = ref<Set<string>>(new Set(['g']))

/** Live (debounced) evaluation; heavy inputs are offloaded by useToolRunner. */
const result = ref<RegexResult | null>(null)
const error = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

const flagsString = computed(() => [...flags.value].join(''))
const risk = computed(() => hasReDoSRisk(pattern.value))

watch([pattern, text, flagsString, replacement, useReplacement], evaluate)

function evaluate(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void doRun(), 180)
}

async function doRun(): Promise<void> {
  if (!pattern.value) {
    result.value = null
    error.value = null
    return
  }
  try {
    result.value = await run<RegexResult>(text.value.length, 'regex', {
      pattern: pattern.value,
      flags: flagsString.value,
      text: text.value,
      replacement: useReplacement.value ? replacement.value : null,
    })
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

function toggleFlag(flag: string): void {
  const next = new Set(flags.value)
  if (next.has(flag)) next.delete(flag)
  else next.add(flag)
  flags.value = next
}

const flagHelp: Record<string, string> = {
  g: 'global — all matches',
  i: 'ignore case',
  m: '^ and $ match line bounds',
  s: '. matches newlines',
  u: 'unicode',
  y: 'sticky — match at lastIndex',
  d: 'indices',
  v: 'unicode sets',
}

const highlightParts = computed(() => {
  if (!result.value?.ok || result.value.matches.length === 0 || result.value.matches.length > 200) return null
  const parts: { text: string; hit: boolean }[] = []
  let cursor = 0
  for (const m of result.value.matches) {
    if (m.index < cursor) continue
    if (m.index > cursor) parts.push({ text: text.value.slice(cursor, m.index), hit: false })
    parts.push({ text: text.value.slice(m.index, m.end), hit: true })
    cursor = m.end
  }
  if (cursor < text.value.length) parts.push({ text: text.value.slice(cursor), hit: false })
  return parts
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>Regex Tester</h1>
      <p>Live matches, named and positional groups, and a replace preview — all evaluated locally.</p>
    </div>

    <div class="row grow">
      <input v-model="pattern" type="text" spellcheck="false" placeholder="Pattern, e.g. (\w+)@(\w+\.\w+)" aria-label="Regular expression" />
      <span v-if="risk" class="badge warn">possible ReDoS shape</span>
    </div>

    <div class="chips">
      <button
        v-for="(help, flag) in flagHelp"
        :key="flag"
        class="chip"
        :class="{ on: flags.has(flag) }"
        type="button"
        :title="help"
        @click="toggleFlag(flag!)"
      >
        {{ flag }}
      </button>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="re-text">Test text</label>
        <span>{{ text.length.toLocaleString() }} chars</span>
      </div>
      <textarea id="re-text" v-model="text" spellcheck="false" placeholder="Paste sample text…"></textarea>
    </div>

    <div class="row">
      <label class="field"><input v-model="useReplacement" type="checkbox" /> Replace</label>
      <input v-if="useReplacement" v-model="replacement" type="text" spellcheck="false" placeholder="Replacement ($1, $<name>…)" aria-label="Replacement" />
    </div>

    <p v-if="error" class="msg bad">{{ error }}</p>
    <p v-else-if="result && !result.ok" class="msg bad">{{ result.error }}</p>

    <template v-if="result?.ok">
      <div class="row">
        <span class="badge" :class="result.matches.length ? 'ok' : ''">
          {{ result.matches.length.toLocaleString() }} match{{ result.matches.length === 1 ? '' : 'es' }}
        </span>
        <span class="badge">{{ result.millis.toFixed(1) }} ms</span>
        <span v-if="result.truncated" class="badge warn">capped — showing first {{ result.matches.length }}</span>
      </div>

      <div v-if="highlightParts && highlightParts.length" class="pane">
        <div class="pane-label"><label>Highlighted text</label></div>
        <p
          style="font-family: var(--mono); font-size: 13px; white-space: pre-wrap; word-break: break-all; margin: 0"
        ><template v-for="(part, i) in highlightParts" :key="i"><mark
            v-if="part.hit"
            style="background: var(--accent); color: var(--accent-ink); border-radius: 2px"
          >{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></p>
      </div>

      <div v-if="result.matches.length" class="matches">
        <div v-for="(m, i) in result.matches" :key="i" class="match">
          <div class="idx">#{{ i + 1 }} · chars {{ m.index }}–{{ m.end }}</div>
          <code>{{ m.text === '' ? '∅ (zero-length)' : m.text }}</code>
          <div v-if="m.groups.length" class="group">
            <template v-for="(g, gi) in m.groups" :key="gi">
              <b>{{ g.name }}</b>
              <span>{{ g.value === undefined ? 'undefined' : g.value === '' ? '∅' : g.value }}</span>
            </template>
          </div>
        </div>
      </div>

      <div v-if="result.replaced !== null" class="pane">
        <div class="pane-label">
          <label for="re-out">Replace result</label>
          <span v-if="result.replacedTruncated" class="badge warn">truncated at 1,000,000 chars</span>
        </div>
        <textarea id="re-out" readonly :value="result.replaced"></textarea>
      </div>
    </template>
  </section>
</template>
