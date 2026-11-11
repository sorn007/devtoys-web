<script setup lang="ts">
import { computed, ref } from 'vue'
import { compareLists, type ListCompareResult } from '@/tools/listcompare'
import { copyText } from '@/lib/clipboard'

const left = ref('')
const right = ref('')
const trim = ref(true)
const ignoreCase = ref(false)

const result = computed<ListCompareResult>(() => compareLists(left.value, right.value, { trim: trim.value, ignoreCase: ignoreCase.value }))

type Section = { id: keyof ListCompareResult; label: string; note: string }
const SECTIONS: Section[] = [
  { id: 'intersection', label: 'In both', note: 'intersection' },
  { id: 'onlyLeft', label: 'Only in left', note: 'left − right' },
  { id: 'onlyRight', label: 'Only in right', note: 'right − left' },
  { id: 'symmetricDiff', label: 'Different', note: 'symmetric difference' },
  { id: 'union', label: 'All unique', note: 'union' },
]

const note = ref('')
async function copy(lines: string[]): Promise<void> {
  note.value = await copyText(lines.join('\n'))
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>List Comparer</h1>
      <p>Compare two line lists with set operations. Duplicates collapse; order is preserved (left first).</p>
    </div>

    <div class="row grow" style="align-items: stretch">
      <div class="pane" style="flex: 1 1 260px">
        <div class="pane-label"><label for="lc-l">Left ({{ result.leftCount.toLocaleString() }} unique of {{ left.split('\n').filter(Boolean).length }})</label></div>
        <textarea id="lc-l" v-model="left" spellcheck="false" style="min-height: 150px"></textarea>
      </div>
      <div class="pane" style="flex: 1 1 260px">
        <div class="pane-label"><label for="lc-r">Right ({{ result.rightCount.toLocaleString() }} unique of {{ right.split('\n').filter(Boolean).length }})</label></div>
        <textarea id="lc-r" v-model="right" spellcheck="false" style="min-height: 150px"></textarea>
      </div>
    </div>

    <div class="row">
      <label class="field"><input v-model="trim" type="checkbox" /> Trim lines</label>
      <label class="field"><input v-model="ignoreCase" type="checkbox" /> Ignore case</label>
      <span v-if="note" class="badge">{{ note }}</span>
    </div>

    <div v-if="left || right" class="row">
      <span class="badge ok">both: {{ result.intersection.length.toLocaleString() }}</span>
      <span class="badge bad">only left: {{ result.leftUnique.toLocaleString() }}</span>
      <span class="badge">only right: {{ result.rightUnique.toLocaleString() }}</span>
      <span class="badge">union: {{ result.union.length.toLocaleString() }}</span>
    </div>

    <div v-for="section in SECTIONS" :key="section.id" class="pane">
      <div class="pane-label">
        <label>{{ section.label }} · {{ (result[section.id] as string[]).length.toLocaleString() }} <span class="dim">({{ section.note }})</span></label>
        <button class="btn" type="button" :disabled="(result[section.id] as string[]).length === 0" @click="copy(result[section.id] as string[])">Copy</button>
      </div>
      <div v-if="(result[section.id] as string[]).length" class="list-box" role="list">
        <div v-for="(line, i) in (result[section.id] as string[]).slice(0, 500)" :key="i" role="listitem">{{ line }}</div>
        <div v-if="(result[section.id] as string[]).length > 500" class="dim" style="padding: 4px 10px">
          showing first 500 of {{ (result[section.id] as string[]).length.toLocaleString() }}
        </div>
      </div>
      <p v-else class="msg dim" style="margin: 0">Nothing in this section.</p>
    </div>
  </section>
</template>
