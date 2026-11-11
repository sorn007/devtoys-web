<script setup lang="ts">
import { ref } from 'vue'
import { useDedicatedWorker } from '@/lib/useDedicatedWorker'
import type { XsdResult } from '@/tools/xsd'

const { run, busy, cancel } = useDedicatedWorker(
  () => new Worker(new URL('../../workers/xsdWorker.ts', import.meta.url), { type: 'module' }),
)

const xml = ref('<root>\n  <a>1</a>\n</root>')
const schema = ref('<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">\n  <xs:element name="root">\n    <xs:complexType><xs:sequence>\n      <xs:element name="a" type="xs:integer"/>\n    </xs:sequence></xs:complexType>\n  </xs:element>\n</xs:schema>')
const result = ref<XsdResult | null>(null)
const error = ref<string | null>(null)

async function validate(): Promise<void> {
  error.value = null
  result.value = null
  try {
    result.value = await run<XsdResult>('xsd-validate', { xml: xml.value, schema: schema.value })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>XML / XSD Tester</h1>
      <p>Validate XML against an XSD schema locally with libxml2 compiled to WebAssembly. No network IO; DTDs and entity declarations are rejected. The validator downloads once (760 kB), then works offline.</p>
    </div>

    <div class="row grow" style="align-items: stretch">
      <div class="pane" style="flex: 1 1 280px">
        <div class="pane-label"><label for="xsd-xml">XML ({{ xml.length.toLocaleString() }} chars)</label></div>
        <textarea id="xsd-xml" v-model="xml" spellcheck="false" style="min-height: 220px"></textarea>
      </div>
      <div class="pane" style="flex: 1 1 280px">
        <div class="pane-label"><label for="xsd-schema">XSD schema ({{ schema.length.toLocaleString() }} chars)</label></div>
        <textarea id="xsd-schema" v-model="schema" spellcheck="false" style="min-height: 220px"></textarea>
      </div>
    </div>

    <div class="row">
      <button class="btn primary" type="button" :disabled="busy" @click="validate()">Validate</button>
      <button v-if="busy" class="btn" type="button" @click="cancel()">Cancel</button>
      <span v-if="busy" class="badge">libxml2 running in a worker…</span>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>
    <!-- Rejected before validation (DTD guard, caps, empty input) -->
    <p v-else-if="result && !result.ok" class="msg bad" role="alert">{{ result.error }}</p>

    <template v-if="result?.ok">
      <div class="row">
        <span class="badge" :class="result.valid ? 'ok' : 'bad'">{{ result.valid ? 'valid' : 'invalid' }}</span>
        <span class="badge">{{ result.errors.length }} error{{ result.errors.length === 1 ? '' : 's' }}</span>
      </div>
      <div v-if="result.errors.length" class="list-box">
        <div v-for="(e, i) in result.errors" :key="i">
          <span v-if="e.line !== null" class="dim">line {{ e.line }}: </span>{{ e.message }}
        </div>
      </div>
      <p v-else class="msg ok">The document satisfies the schema.</p>
    </template>
  </section>
</template>
