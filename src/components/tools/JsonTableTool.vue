<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Table } from '@/tools/jsontable'
import { useDedicatedWorker } from '@/lib/useDedicatedWorker'
import { TABLE_MAX_ROWS } from '@/lib/limits'
import { copyText } from '@/lib/clipboard'

// Dedicated worker: parsing a large array and serialising CSV never block the UI.
const { run, busy, cancel } = useDedicatedWorker(
  () => new Worker(new URL('../../workers/jsonTableWorker.ts', import.meta.url), { type: 'module' }),
)

const input = ref('')
const delimiter = ref<',' | '\t' | ';'>(',')
const crlf = ref(true)
const safeExport = ref(true)
const error = ref<string | null>(null)
const note = ref('')
const table = ref<Table | null>(null)
const exportText = ref('')

async function refresh(): Promise<void> {
  error.value = null
  note.value = ''
  exportText.value = ''
  if (!input.value.trim()) {
    table.value = null
    return
  }
  try {
    table.value = await run<Table>('json-table', { input: input.value })
  } catch (err) {
    table.value = null
    error.value = err instanceof Error ? err.message : String(err)
  }
}

watch([table, delimiter, crlf, safeExport], async () => {
  if (!table.value) {
    exportText.value = ''
    return
  }
  try {
    exportText.value = await run<string>('table-csv', {
      table: table.value,
      delimiter: delimiter.value,
      crlf: crlf.value,
      safeExport: safeExport.value,
    })
  } catch {
    exportText.value = ''
  }
})

async function copy(): Promise<void> {
  note.value = await copyText(exportText.value)
}

function download(): void {
  if (!exportText.value) return
  // A short-lived object URL revoked immediately after the click.
  const blob = new Blob([exportText.value], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `table.${delimiter.value === '\t' ? 'tsv' : 'csv'}`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>JSON Array → Table / CSV</h1>
      <p>Turn an array of objects into a table and export CSV/TSV. Cells render as text — never as HTML.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="jt-in">JSON array</label>
        <span>{{ input.length.toLocaleString() }} chars</span>
      </div>
      <textarea id="jt-in" v-model="input" spellcheck="false" placeholder='[{"name":"Ada","born":1815}]' @input="refresh()"></textarea>
      <div v-if="busy" class="row" style="margin-top: 6px">
        <span class="badge">working in a background worker…</span>
        <button class="btn" type="button" @click="cancel()">Cancel</button>
      </div>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>

    <template v-if="table">
      <div class="row">
        <label class="field">
          Delimiter
          <select v-model="delimiter" style="width: auto">
            <option value=",">comma (CSV)</option>
            <option value="\t">tab (TSV)</option>
            <option value=";">semicolon</option>
          </select>
        </label>
        <label class="field"><input v-model="crlf" type="checkbox" /> CRLF line endings</label>
        <label class="field" title="Prefixes cells starting with = + - @ (or a leading tab/CR) with an apostrophe so spreadsheets do not execute them.">
          <input v-model="safeExport" type="checkbox" /> Safe spreadsheet export
        </label>
        <button class="btn primary" type="button" :disabled="!exportText" @click="download()">Download</button>
        <button class="btn" type="button" :disabled="!exportText" @click="copy()">Copy</button>
        <span class="badge">{{ table.totalRows.toLocaleString() }} rows · {{ table.headers.length }} columns</span>
        <span v-if="table.truncated" class="badge warn">table view capped at {{ TABLE_MAX_ROWS.toLocaleString() }} rows</span>
      </div>
      <p v-if="safeExport" class="msg dim">
        Safe export prefixes cells that start with <code>=</code>, <code>+</code>, <code>-</code>, <code>@</code> or a tab
        with an apostrophe so spreadsheet apps treat them as text instead of formulas. Turn it off for a byte-faithful export.
      </p>

      <div class="pane">
        <div class="pane-label"><label>Table preview (text only)</label></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th v-for="h in table.headers" :key="h">{{ h }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in table.rows" :key="i">
                <td v-for="(cell, j) in row" :key="j">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="pane">
        <div class="pane-label">
          <label for="jt-out">Export text</label>
          <span v-if="note" class="badge">{{ note }}</span>
        </div>
        <textarea id="jt-out" class="auto-height" readonly :value="exportText" :rows="Math.min(Math.max(exportText.split('\n').length - 1, 3), 16)"></textarea>
      </div>
    </template>
  </section>
</template>
