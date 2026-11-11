<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  BIT_WIDTHS,
  COMMON_BASES,
  formatBase,
  MAX_BASE,
  parseInBase,
  twosComplement,
  validateBaseInput,
} from '@/tools/numberbase'
import { copyText } from '@/lib/clipboard'

const input = ref('255')
const base = ref(10)
const customBase = ref(36)
const note = ref('')

const error = computed(() => validateBaseInput(input.value, base.value))
const value = computed(() => (error.value ? null : parseInBase(input.value, base.value)))

const outputs = computed(() => {
  if (value.value === null) return []
  const bases: number[] = [...COMMON_BASES]
  if (!bases.includes(customBase.value)) bases.push(customBase.value)
  return bases.map((b) => ({ base: b, text: formatBase(value.value!, b, b === 16) }))
})

const bitViews = computed(() => {
  if (value.value === null) return []
  return BIT_WIDTHS.map((bits) => {
    try {
      return { bits, text: twosComplement(value.value!, bits) }
    } catch (err) {
      return { bits, text: err instanceof Error ? err.message : 'out of range' }
    }
  })
})

const magnitude = computed(() => {
  if (value.value === null) return ''
  const digits = value.value.toString().length
  return digits > 15 ? `${digits} decimal digits (arbitrary precision)` : ''
})

async function copy(text: string): Promise<void> {
  note.value = await copyText(text)
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>Number Base Converter</h1>
      <p>Integers between bases 2–36 with arbitrary precision (BigInt), plus two's-complement views.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="nb-in">Value</label>
        <span v-if="magnitude" class="badge">{{ magnitude }}</span>
      </div>
      <div class="row grow">
        <input
          id="nb-in"
          v-model="input"
          type="text"
          spellcheck="false"
          :placeholder="base === 16 ? 'ff' : '255'"
          @input="note = ''"
        />
        <label class="field">
          Input base
          <select v-model.number="base" style="width: auto">
            <option v-for="b in COMMON_BASES" :key="b" :value="b">base {{ b }}</option>
          </select>
        </label>
      </div>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>

    <template v-if="value !== null">
      <div class="pane">
        <div class="pane-label">
          <label>All bases</label>
          <span v-if="note" class="badge">{{ note }}</span>
        </div>
        <dl class="kv">
          <template v-for="row in outputs" :key="row.base">
            <dt>base {{ row.base }}</dt>
            <dd>
              <button class="kv-copy" type="button" @click="copy(row.text)">{{ row.text }}</button>
            </dd>
          </template>
          <dt>custom</dt>
          <dd class="custom-base">
            <input
              v-model.number="customBase"
              type="number"
              min="2"
              :max="MAX_BASE"
              style="width: 90px"
              aria-label="Custom base"
            />
            <span class="mono">{{ formatBase(value, customBase) }}</span>
          </dd>
        </dl>
      </div>

      <div class="pane">
        <div class="pane-label"><label>Two's complement (hex)</label></div>
        <dl class="kv">
          <template v-for="row in bitViews" :key="row.bits">
            <dt>{{ row.bits }}-bit</dt>
            <dd :class="{ 'dd-err': row.text.includes(' ') }">{{ row.text }}</dd>
          </template>
        </dl>
      </div>
    </template>
  </section>
</template>
