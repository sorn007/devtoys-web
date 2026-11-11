<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  dedupeLines,
  reverseLines,
  sortLines,
  squeezeBlanks,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
  toTitleCase,
  trimLines,
  type TextStats,
} from '@/tools/analyzer'
import { useToolRunner } from '@/lib/useToolRunner'
import { copyText } from '@/lib/clipboard'

const { run, busy } = useToolRunner()
const input = ref('')
const stats = ref<TextStats | null>(null)
const output = ref('')
const note = ref('')

async function refresh(): Promise<void> {
  stats.value = await run<TextStats>(input.value.length, 'analyzer-stats', { input: input.value })
  output.value = ''
}

const STAT_ROWS = computed(() => {
  const s = stats.value
  if (!s) return [] as { key: string; value: string }[]
  return [
    { key: 'Characters', value: s.characters.toLocaleString() },
    { key: 'Characters (no spaces)', value: s.charactersNoSpaces.toLocaleString() },
    { key: 'Words', value: s.words.toLocaleString() },
    { key: 'Lines', value: s.lines.toLocaleString() },
    { key: 'Sentences', value: s.sentences.toLocaleString() },
    { key: 'Paragraphs', value: s.paragraphs.toLocaleString() },
    { key: 'UTF-8 bytes', value: s.bytes.toLocaleString() },
    { key: 'Unicode code points', value: s.codePoints.toLocaleString() },
    { key: 'Graphemes', value: s.graphemes.toLocaleString() },
    { key: 'Longest line', value: s.longestLine.toLocaleString() },
    { key: 'Reading time (≈200 wpm)', value: `${s.readingMinutes} min` },
  ]
})

type Util = { id: string; label: string; apply: (t: string) => string }
const UTILITIES: Util[] = [
  { id: 'trim', label: 'Trim & drop empty lines', apply: trimLines },
  { id: 'dedupe', label: 'Remove duplicate lines', apply: dedupeLines },
  { id: 'sort', label: 'Sort lines (natural)', apply: (t) => sortLines(t) },
  { id: 'sortDesc', label: 'Sort lines descending', apply: (t) => sortLines(t, { descending: true }) },
  { id: 'reverse', label: 'Reverse line order', apply: reverseLines },
  { id: 'squeeze', label: 'Squeeze blank lines', apply: squeezeBlanks },
  { id: 'upper', label: 'UPPER CASE', apply: (t) => t.toUpperCase() },
  { id: 'lower', label: 'lower case', apply: (t) => t.toLowerCase() },
  { id: 'title', label: 'Title Case', apply: toTitleCase },
  { id: 'camel', label: 'camelCase', apply: toCamelCase },
  { id: 'pascal', label: 'PascalCase', apply: toPascalCase },
  { id: 'snake', label: 'snake_case', apply: toSnakeCase },
  { id: 'kebab', label: 'kebab-case', apply: toKebabCase },
]

function apply(util: Util): void {
  if (!input.value) return
  output.value = util.apply(input.value)
}

async function copy(): Promise<void> {
  note.value = await copyText(output.value)
}

function swapIn(): void {
  if (!output.value) return
  input.value = output.value
  output.value = ''
  void refresh()
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>Text Analyzer &amp; Utilities</h1>
      <p>Unicode-aware statistics plus line and case utilities. Everything is a single-pass transform; nothing is evaluated.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="an-in">Text</label>
        <span>{{ input.length.toLocaleString() }} chars</span>
      </div>
      <textarea id="an-in" v-model="input" spellcheck="false" style="min-height: 150px" @input="refresh()"></textarea>
    </div>

    <div v-if="stats" class="pane">
      <div class="pane-label"><label>Statistics</label><span v-if="busy" class="badge">analysing…</span></div>
      <dl class="kv kv-grid">
        <template v-for="row in STAT_ROWS" :key="row.key">
          <dt>{{ row.key }}</dt>
          <dd>{{ row.value }}</dd>
        </template>
      </dl>
    </div>

    <div class="pane">
      <div class="pane-label"><label>Utilities</label></div>
      <div class="chips">
        <button v-for="util in UTILITIES" :key="util.id" class="chip" type="button" :disabled="!input" @click="apply(util)">
          {{ util.label }}
        </button>
      </div>
    </div>

    <div v-if="output" class="pane">
      <div class="pane-label">
        <label for="an-out">Result</label>
        <span>
          <button class="btn" type="button" @click="copy()">Copy</button>
          <button class="btn" type="button" @click="swapIn()">Use as input</button>
        </span>
      </div>
      <textarea id="an-out" readonly :value="output" style="max-height: 45vh"></textarea>
      <span v-if="note" class="badge">{{ note }}</span>
    </div>
  </section>
</template>
