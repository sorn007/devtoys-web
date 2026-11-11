<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToolRunner } from '@/lib/useToolRunner'
import { type DiffResult } from '@/tools/diff'
import { copyText } from '@/lib/clipboard'

const { run, busy } = useToolRunner()

const left = ref('')
const right = ref('')
const result = ref<DiffResult | null>(null)
const error = ref<string | null>(null)
const note = ref('')
/** Rows rendered is bounded independently of the computed script. */
const MAX_RENDERED_ROWS = 3_000
const collapsed = ref(true)
const ignoreWhitespace = ref(false)
const ignoreCase = ref(false)

const rows = computed(() => {
  if (!result.value) return []
  return collapsed.value ? result.value.rows.filter((r) => r.op !== 'equal') : result.value.rows
})

const hiddenEqual = computed(() => (result.value ? result.value.rows.length - rows.value.length : 0))
const renderTruncated = computed(() => rows.value.length > MAX_RENDERED_ROWS)
const visibleRows = computed(() => rows.value.slice(0, MAX_RENDERED_ROWS))

async function go(): Promise<void> {
  error.value = null
  note.value = ''
  try {
    result.value = await run<DiffResult>(left.value.length + right.value.length, 'diff', {
      left: left.value,
      right: right.value,
      ignoreWhitespace: ignoreWhitespace.value,
      ignoreCase: ignoreCase.value,
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    result.value = null
  }
}

function swap(): void {
  const a = left.value
  left.value = right.value
  right.value = a
}

async function copyPatch(): Promise<void> {
  if (!result.value) return
  const patch = result.value.rows
    .map((r) => (r.op === 'added' ? `+${r.text}` : r.op === 'removed' ? `-${r.text}` : ` ${r.text}`))
    .join('\n')
  note.value = await copyText(patch)
}

</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>Text Diff</h1>
      <p>Line-level comparison. Exact (Myers) for normal inputs; set-based coarse mode for very large ones.</p>
    </div>

    <div class="row grow" style="align-items: stretch">
      <div class="pane" style="flex: 1 1 260px">
        <div class="pane-label"><label for="diff-l">Left / original ({{ left.split('\n').length }} lines)</label></div>
        <textarea id="diff-l" v-model="left" spellcheck="false" style="min-height: 170px"></textarea>
      </div>
      <div class="pane" style="flex: 1 1 260px">
        <div class="pane-label"><label for="diff-r">Right / changed ({{ right.split('\n').length }} lines)</label></div>
        <textarea id="diff-r" v-model="right" spellcheck="false" style="min-height: 170px"></textarea>
      </div>
    </div>

    <div class="row">
      <button class="btn primary" type="button" :disabled="busy" @click="go()">Compare</button>
      <button class="btn" type="button" @click="swap">Swap sides</button>
      <button class="btn" type="button" @click="copyPatch" :disabled="!result">Copy as patch</button>
      <label class="field"><input v-model="collapsed" type="checkbox" /> Changes only</label>
      <label class="field" title="Lines are compared after trimming; the display keeps the original text.">
        <input v-model="ignoreWhitespace" type="checkbox" @change="go()" /> Ignore whitespace
      </label>
      <label class="field" title="Case-insensitive comparison; the display keeps original casing.">
        <input v-model="ignoreCase" type="checkbox" @change="go()" /> Ignore case
      </label>
    </div>

    <p v-if="error" class="msg bad">{{ error }}</p>

    <template v-if="result">
      <div class="row">
        <span v-if="result.mode === 'identical'" class="badge ok">identical</span>
        <template v-else>
          <span class="badge bad">{{ result.removed }} removed</span>
          <span class="badge ok">{{ result.added }} added</span>
          <span class="badge">{{ result.unchanged }} unchanged</span>
          <span class="badge" :class="result.mode === 'exact' ? '' : 'warn'">
            {{ result.mode === 'exact' ? 'exact alignment' : 'coarse (input too large to align)' }}
          </span>
        </template>
      </div>

      <div class="diff" role="table" aria-label="Diff output">
        <div v-for="(row, i) in visibleRows" :key="i" class="diff-row" :class="row.op">
          <span class="diff-no">{{ row.leftNo ?? '' }}</span>
          <span class="diff-no">{{ row.rightNo ?? '' }}</span>
          <span class="diff-text">{{ row.text || ' ' }}</span>
        </div>
      </div>

      <div class="row">
        <button v-if="hiddenEqual > 0" class="btn" type="button" @click="collapsed = !collapsed">
          {{ collapsed ? `Show ${hiddenEqual.toLocaleString()} unchanged lines` : 'Hide unchanged lines' }}
        </button>
        <span v-if="renderTruncated" class="badge warn">
          showing first {{ MAX_RENDERED_ROWS.toLocaleString() }} rows of {{ rows.length.toLocaleString() }}
        </span>
        <span v-if="note" class="badge">{{ note }}</span>
      </div>
    </template>
  </section>
</template>
