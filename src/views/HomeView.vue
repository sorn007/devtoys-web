<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { navigate } from '@/router'
import { CATEGORIES, searchTools, TOOLS, type ToolMeta, type ToolCategory } from '@/tools/registry'
import { prefs } from '@/lib/prefs'

const query = ref('')
const category = ref<ToolCategory | ''>('')
const menuOpen = ref(false)
const searchEl = ref<HTMLInputElement | null>(null)
const expanded = ref<ToolCategory[]>([])
const searching = computed(() => query.value.trim().length > 0)
const results = computed(() => searchTools(query.value).filter(t => !category.value || t.category === category.value).sort((a, b) => a.name.localeCompare(b.name)))
const recent = computed(() => {
  const ids = prefs.getString('recentTools', prefs.getString('recentTool')).split(',')
  return ids.map(id => TOOLS.find(t => t.id === id)).filter((t): t is ToolMeta => !!t).slice(0, 4)
})
const sections = computed(() => [
  ...(!searching.value && !category.value && recent.value.length ? [{ title: 'Recents', tools: recent.value }] : []),
  { title: searching.value ? 'Search results' : category.value || 'All tools', tools: results.value },
])
function open(tool: ToolMeta): void {
  prefs.setString('recentTool', tool.id)
  prefs.setString('recentTools', [tool.id, ...recent.value.map(t => t.id).filter(id => id !== tool.id)].slice(0, 4).join(','))
  navigate({ name: 'tool', id: tool.id })
}
function selectCategory(value: ToolCategory | ''): void {
  category.value = value
  query.value = ''
  menuOpen.value = false
  window.scrollTo({ top: 0 })
}
function toggleGroup(value: ToolCategory): void {
  expanded.value = expanded.value.includes(value) ? expanded.value.filter(c => c !== value) : [...expanded.value, value]
}
function onKey(event: KeyboardEvent): void {
  const target = event.target as HTMLElement
  if (event.key === '/' && !target.closest('input, textarea, select, [contenteditable="true"]')) {
    event.preventDefault()
    searchEl.value?.focus()
  }
  if (event.key === 'Escape') menuOpen.value = false
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <section class="tool-directory">
    <aside class="directory-sidebar" aria-label="Tool navigation">
      <div class="directory-search">
        <label for="tool-search">Find your tool</label>
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.7"/></svg>
          <input id="tool-search" ref="searchEl" v-model="query" type="search" placeholder="Search tools…" autocomplete="off" spellcheck="false" @input="category = ''" />
          <button v-if="query" class="search-clear" aria-label="Clear search" @click="query = ''">×</button>
          <kbd v-else class="kbd">/</kbd>
        </div>
      </div>
      <button class="directory-mobile-toggle" :aria-expanded="menuOpen" aria-controls="directory-navigation" @click="menuOpen = !menuOpen">Browse categories <span aria-hidden="true">{{ menuOpen ? '−' : '+' }}</span></button>
      <nav id="directory-navigation" :class="{ 'is-open': menuOpen }" aria-label="Categories">
        <button class="directory-nav-item" :class="{ selected: !category && !searching }" :aria-current="!category && !searching ? 'page' : undefined" @click="selectCategory('')">
          <svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10H5V10M9 20v-7h6v7"/></svg>
          <span>All tools</span><small>{{ TOOLS.length }}</small>
        </button>
        <div v-if="recent.length" class="sidebar-recents">
          <p class="nav-caption">Recently used</p>
          <button v-for="tool in recent.slice(0, 3)" :key="tool.id" class="directory-nav-item" @click="open(tool)"><svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="tool.icon"/></svg><span>{{ tool.name }}</span></button>
        </div>
        <p class="nav-caption">Categories</p>
        <div v-for="(item, index) in CATEGORIES" :key="item" class="directory-category">
          <div class="category-row">
            <button class="directory-nav-item" :class="{ selected: category === item }" :aria-current="category === item ? 'page' : undefined" @click="selectCategory(item)">
              <svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="TOOLS.find(t => t.category === item)?.icon"/></svg><span>{{ item }}</span>
            </button>
            <button class="category-expand" :aria-label="`${expanded.includes(item) ? 'Collapse' : 'Expand'} ${item}`" :aria-expanded="expanded.includes(item)" :aria-controls="`category-${index}`" @click="toggleGroup(item)"><svg viewBox="0 0 24 24" :class="{ rotated: expanded.includes(item) }" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></button>
          </div>
          <div v-show="expanded.includes(item)" :id="`category-${index}`" class="category-children"><button v-for="tool in TOOLS.filter(t => t.category === item)" :key="tool.id" @click="open(tool)">{{ tool.name }}</button></div>
        </div>
      </nav>
      <div class="sidebar-note"><span class="local-dot" aria-hidden="true"></span><div><b>Your data stays yours</b><p>Local processing. No uploads.</p></div></div>
    </aside>

    <div class="directory-main">
      <header class="directory-hero">
        <div class="directory-eyebrow">YOUR EVERYDAY DEVELOPER COMPANION</div>
        <h1>Welcome to Toolbox</h1>
        <p>A little less busywork.<br class="mobile-break" /> A little more building.</p>
        <div class="hero-details"><span>{{ TOOLS.length }} tools</span><span>7 categories</span><span>Private by design</span></div>
      </header>
      <div class="directory-sections">
        <section v-for="section in sections" :key="section.title" class="directory-section" :aria-label="section.title">
          <div class="directory-section-heading"><h2>{{ section.title }}</h2><span aria-live="polite">{{ section.tools.length }} tools</span><button v-if="category || searching" class="directory-reset" @click="selectCategory('')">Show all tools</button></div>
          <div v-if="section.tools.length" class="directory-grid">
            <button v-for="tool in section.tools" :key="tool.id" class="directory-card" @click="open(tool)">
              <span class="directory-card-icon"><svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="tool.icon"/></svg></span>
              <span class="directory-card-copy"><small>{{ tool.category }}</small><b>{{ tool.name }}</b><span>{{ tool.description }}</span></span>
              <svg class="card-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>
            </button>
          </div>
          <div v-else class="empty-state"><p>No tools found for “{{ query }}”</p><p class="dim">Try a tool name or keyword, such as JSON, hash or image.</p><button class="btn" @click="selectCategory('')">Clear search</button></div>
        </section>
      </div>
    </div>
  </section>
</template>
