<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { CATEGORIES, searchTools } from '@/tools/registry'
import { navigate, route } from '@/router'

const dialog = ref<HTMLDialogElement | null>(null)
const search = ref<HTMLInputElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const query = ref('')
const isOpen = ref(false)
const groups = computed(() => {
  const tools = searchTools(query.value)
  return CATEGORIES.map(category => ({ category, tools: tools.filter(t => t.category === category) })).filter(g => g.tools.length)
})
async function show(): Promise<void> {
  query.value = ''
  dialog.value?.showModal()
  isOpen.value = true
  await nextTick()
  search.value?.focus()
}
function close(): void { dialog.value?.close() }
function closed(): void {
  isOpen.value = false
  trigger.value?.focus()
}
function choose(id?: string): void {
  navigate(id ? { name: 'tool', id } : { name: 'home' })
  close()
}
</script>

<template>
  <button ref="trigger" class="icon-btn tool-menu-trigger" type="button" aria-label="Open tool menu" aria-haspopup="dialog" aria-controls="tool-menu" :aria-expanded="isOpen" @click="show">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
  </button>
  <dialog id="tool-menu" ref="dialog" class="tool-switcher" aria-labelledby="tool-menu-title" @close="closed" @click="event => { if (event.target === dialog) close() }">
    <div class="tool-switcher-body">
      <div class="tool-switcher-heading"><h2 id="tool-menu-title">Switch tools</h2><button class="icon-btn" type="button" aria-label="Close tool menu" @click="close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
      <label for="switcher-search">Find a tool</label>
      <input id="switcher-search" ref="search" v-model="query" type="search" placeholder="Search tools…" autocomplete="off" />
      <nav aria-label="Switch tools">
        <button class="directory-nav-item" :aria-current="route.name === 'home' ? 'page' : undefined" @click="choose()">All tools</button>
        <p v-if="!groups.length" role="status">No tools found for “{{ query }}”.</p>
        <section v-for="group in groups" :key="group.category">
          <h3 class="nav-caption">{{ group.category }}</h3>
          <button v-for="tool in group.tools" :key="tool.id" class="directory-nav-item" :class="{ selected: route.name === 'tool' && route.id === tool.id }" :aria-current="route.name === 'tool' && route.id === tool.id ? 'page' : undefined" @click="choose(tool.id)">
            <svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="tool.icon"/></svg><span>{{ tool.name }}</span>
          </button>
        </section>
      </nav>
    </div>
  </dialog>
</template>

<style scoped>
.tool-menu-trigger { margin-left: 0 !important; width: 44px; height: 44px; flex-shrink: 0; }
.tool-switcher { position: fixed; inset: 0 auto 0 0; margin: 0; padding: 0; width: min(360px, 100vw); height: 100dvh; max-height: 100dvh; max-width: 100vw; color: var(--fg); background: var(--surface-2); border: 0; border-right: 1px solid var(--line); box-shadow: 12px 0 40px #0003; }
.tool-switcher::backdrop { background: #0007; }
.tool-switcher-body { padding: 20px 16px; }
.tool-switcher-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
.tool-switcher-heading h2 { margin: 0; font-size: 20px; }
.tool-switcher-heading .icon-btn { width: 44px; height: 44px; }
label { display: block; color: var(--fg-dim); font-size: 13px; margin-bottom: 8px; }
input { font-family: var(--sans); margin-bottom: 16px; }
</style>
