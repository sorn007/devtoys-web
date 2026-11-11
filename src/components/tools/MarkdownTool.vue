<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { renderMarkdown, type RenderResult } from '@/tools/markdown'
import { MARKDOWN_MAX_CHARS } from '@/tools/markdown'

const input = ref('# Hello\n\nThis preview is **local-only**: nothing is sent anywhere.\n')
const allowRemoteImages = ref(false) // session-only; deliberately never persisted
const view = ref<'split' | 'preview' | 'source'>('split')
const result = ref<RenderResult | null>(null)
const sandboxSrcdoc = ref('')

let timer: ReturnType<typeof setTimeout> | null = null
watch([input, allowRemoteImages], schedule)

function schedule(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void render(), 200)
}

/** DOMPurify needs a DOM, so it runs here in the browser, on top of the pure layers. */
async function sanitizeWithDomPurify(html: string): Promise<string> {
  const { default: createDOMPurify } = await import('dompurify')
  const purify = createDOMPurify(window)
  return purify.sanitize(html, {
    ALLOWED_ATTR: ['href', 'title', 'src', 'alt', 'align', 'class', 'colspan', 'rowspan'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'style', 'link', 'meta', 'base'],
    ALLOW_DATA_ATTR: false,
  })
}

async function render(): Promise<void> {
  if (!input.value.trim()) {
    result.value = null
    sandboxSrcdoc.value = ''
    return
  }
  const r = await renderMarkdown(input.value, { allowRemoteImages: allowRemoteImages.value })
  result.value = r
  if (r.ok) {
    const clean = await sanitizeWithDomPurify(r.html)
    sandboxSrcdoc.value = `<!doctype html><html><head><meta charset="utf-8"><style>
      body { font: 15px/1.6 system-ui, sans-serif; margin: 0; padding: 14px 18px; color-scheme: light dark; }
      pre { overflow: auto; padding: 10px; border-radius: 6px; background: rgba(127,127,127,.15); }
      code { font-family: ui-monospace, monospace; font-size: 13px; }
      table { border-collapse: collapse; } th, td { border: 1px solid rgba(127,127,127,.4); padding: 4px 9px; }
      img { max-width: 100%; }
      .md-img-blocked { display: inline-block; padding: 2px 8px; border: 1px dashed rgba(127,127,127,.6);
        border-radius: 6px; opacity: .8; font-size: 12px; }
    </style></head><body>${clean}</body></html>`
  } else {
    sandboxSrcdoc.value = ''
  }
}

void render()

const lineCount = computed(() => input.value.split('\n').length)
</script>

<template>
  <section class="tool">
    <div class="tool-head">
      <h1>Markdown Preview</h1>
      <p>Renders locally in a sandboxed iframe. Raw HTML in the source is escaped, unsafe link schemes are dropped, and remote images stay blocked unless you allow them for this session.</p>
    </div>

    <div class="row">
      <label class="field">
        View
        <select v-model="view" style="width: auto">
          <option value="split">Split</option>
          <option value="preview">Preview</option>
          <option value="source">Source</option>
        </select>
      </label>
      <label class="field" title="Loads http(s) images for this visit only. Never remembered.">
        <input v-model="allowRemoteImages" type="checkbox" /> Allow remote images (this session)
      </label>
      <span class="badge">{{ input.length.toLocaleString() }} / {{ MARKDOWN_MAX_CHARS.toLocaleString() }} chars</span>
      <span v-if="allowRemoteImages" class="badge warn">remote images enabled — session only</span>
    </div>

    <p v-if="result && !result.ok" class="msg bad" role="alert">{{ result.error }}</p>

    <div class="row grow" style="align-items: stretch">
      <div v-if="view !== 'preview'" class="pane" style="flex: 1 1 280px">
        <div class="pane-label">
          <label for="md-in">Markdown ({{ lineCount }} lines)</label>
        </div>
        <textarea id="md-in" v-model="input" spellcheck="false" style="min-height: 380px"></textarea>
      </div>
      <div v-if="view !== 'source'" class="pane" style="flex: 1 1 280px">
        <div class="pane-label">
          <label>Preview (sandboxed)</label>
          <span class="badge">no scripts · no forms</span>
        </div>
        <!-- sandbox="" blocks scripts, forms, popups, same-origin access;
             the HTML inside is additionally DOMPurify-sanitised. -->
        <iframe
          :srcdoc="sandboxSrcdoc"
          sandbox=""
          title="Markdown preview"
          style="flex: 1; width: 100%; min-height: 380px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface)"
        ></iframe>
      </div>
    </div>
  </section>
</template>
