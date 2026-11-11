<script setup lang="ts">
import { computed, ref } from 'vue'
import { claimViews, decodeJwt } from '@/tools/jwt'
import { copyText } from '@/lib/clipboard'

const token = ref('')
const error = ref<string | null>(null)
const note = ref('')

const decoded = computed(() => {
  if (!token.value.trim()) return null
  try {
    error.value = null
    return decodeJwt(token.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    return null
  }
})

const headerRows = computed(() => (decoded.value ? claimViews(decoded.value.header) : []))
const payloadRows = computed(() => (decoded.value ? claimViews(decoded.value.payload) : []))

async function copy(text: string): Promise<void> {
  note.value = await copyText(text)
}
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>JWT Decoder</h1>
      <p>Decode a token's header and payload locally. <strong>Signatures are NOT verified</strong> — treat every claim below as unverified input, not as proof of anything.</p>
    </div>

    <div class="pane">
      <div class="pane-label">
        <label for="jwt-in">Token</label>
        <span>{{ token.length.toLocaleString() }} chars · never sent anywhere</span>
      </div>
      <textarea id="jwt-in" v-model="token" class="mono" spellcheck="false" style="min-height: 100px" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSJ9.signature"></textarea>
    </div>

    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>

    <template v-if="decoded">
      <div class="row">
        <span class="badge warn">decoded — NOT verified</span>
        <span class="badge">{{ decoded.segments }} segments</span>
        <span class="badge" :class="decoded.signaturePresent ? '' : 'bad'">
          {{ decoded.signaturePresent ? 'signature segment present (unchecked)' : 'no signature segment' }}
        </span>
      </div>
      <p v-for="w in decoded.warnings" :key="w" class="msg bad" role="status">{{ w }}</p>

      <div class="pane">
        <div class="pane-label">
          <label>Header</label>
          <button class="btn" type="button" @click="copy(JSON.stringify(decoded.header, null, 2))">Copy JSON</button>
        </div>
        <dl class="kv">
          <template v-for="row in headerRows" :key="row.key">
            <dt>{{ row.key }}</dt>
            <dd>{{ row.raw }}</dd>
          </template>
        </dl>
      </div>

      <div class="pane">
        <div class="pane-label">
          <label>Payload claims</label>
          <button class="btn" type="button" @click="copy(JSON.stringify(decoded.payload, null, 2))">Copy JSON</button>
        </div>
        <dl class="kv">
          <template v-for="row in payloadRows" :key="row.key">
            <dt>{{ row.key }}</dt>
            <dd>
              {{ row.raw }}
              <span v-if="row.human" class="dim"> → {{ row.human }}</span>
              <span v-if="row.state === 'expired'" class="badge bad">expired</span>
              <span v-else-if="row.state === 'not-yet'" class="badge warn">not yet valid</span>
            </dd>
          </template>
        </dl>
      </div>
      <p class="msg dim">Date claims (exp, iat, nbf…) are shown in UTC. This tool performs no signature, issuer or audience validation, and makes no network requests.</p>
      <span v-if="note" class="badge">{{ note }}</span>
    </template>
  </section>
</template>
