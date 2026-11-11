<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { navigate } from '@/router'
import { CATEGORIES, searchTools, TOOLS, type ToolMeta } from '@/tools/registry'
import { prefs } from '@/lib/prefs'

/** Search state is deliberately NOT persisted — only the last-used tool is. */
const query = ref('')
const searchEl = ref<HTMLInputElement | null>(null)

const results = computed<ToolMeta[]>(() => searchTools(query.value))

/** Empty categories are hidden; with no query the order is the registry's. */
const groups = computed(() => {
  return CATEGORIES.map((category) => ({
    category,
    tools: results.value.filter((tool) => tool.category === category),
  })).filter((group) => group.tools.length > 0)
})

const total = computed(() => results.value.length)
const searching = computed(() => query.value.trim().length > 0)

const recent = computed<ToolMeta[]>(() => {
  const id = prefs.getString('recentTool', '')
  return id ? TOOLS.filter((tool) => tool.id === id) : []
})

onMounted(() => {
  searchEl.value?.focus()
  // Keyboard-first UX, like the desktop app's type-to-search.
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
})

function onKey(event: KeyboardEvent): void {
  if (event.key === '/' && document.activeElement !== searchEl.value) {
    event.preventDefault()
    searchEl.value?.focus()
  }
}

function open(tool: ToolMeta): void {
  prefs.setString('recentTool', tool.id)
  navigate({ name: 'tool', id: tool.id })
}
</script>

<template>
  <section class="home">
    <div class="hero">
      <h1>Developer utilities</h1>
      <p>Seven focused tools that run entirely in this tab. Nothing you paste here ever leaves your browser.</p>
    </div>

    <div class="search-wrap">
      <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8" fill="none" />
        <path d="m16.2 16.2 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      <input
        ref="searchEl"
        v-model="query"
        class="search"
        type="search"
        placeholder="Search tools, try “json” or “checksum”…"
        autocomplete="off"
        spellcheck="false"
        aria-label="Search tools"
      />
      <kbd v-if="!searching" class="kbd">/</kbd>
    </div>

    <div class="row home-meta">
      <span class="badge" aria-live="polite">{{ total }} of {{ TOOLS.length }} tools</span>
      <button v-if="recent.length" class="btn btn-ghost" type="button" @click="open(recent[0]!)">
        <svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="recent[0]!.icon" /></svg>
        Recent: {{ recent[0]!.name }}
      </button>
    </div>

    <div v-if="total === 0" class="empty-state">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8" fill="none" />
        <path d="m16.2 16.2 4 4M8.5 11h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      <p>No tool matches “{{ query }}”.</p>
      <p class="dim">This build ships a first slice of DevToys-style tools — the rest are tracked in the feature-parity checklist in the README.</p>
      <button class="btn" type="button" @click="query = ''">Clear search</button>
    </div>

    <div v-for="group in groups" :key="group.category" class="group">
      <h2>
        {{ group.category }}
        <span class="count">{{ group.tools.length }}</span>
      </h2>
      <div class="tool-grid">
        <button v-for="tool in group.tools" :key="tool.id" class="tool-card" type="button" @click="open(tool)">
          <svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="tool.icon" /></svg>
          <b>{{ tool.name }}</b>
          <span>{{ tool.description }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
