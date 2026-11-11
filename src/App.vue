<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { route, goHome } from '@/router'
import { findTool } from '@/tools/registry'
import { applyTheme, currentTheme, toggleTheme, type Theme } from '@/lib/theme'
import ToolMenu from '@/components/ToolMenu.vue'
import { prefs } from '@/lib/prefs'

const HomeView = defineAsyncComponent(() => import('@/views/HomeView.vue'))

const theme = ref<Theme>('dark')
onMounted(() => {
  theme.value = currentTheme()
  applyTheme(theme.value)
  // A new service worker took control (autoUpdate). Offer an explicit reload
  // instead of leaving the user on a mix of old shell + new tool chunks.
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    updateReady.value = true
  })
})

const updateReady = ref(false)
function reload(): void {
  location.reload()
}

function onToggleTheme(): void {
  theme.value = toggleTheme()
}

/**
 * The active tool component is a defineAsyncComponent over the registry's
 * dynamic import. Switching tools unmounts the previous component entirely —
 * there is deliberately no <KeepAlive>, so a tool's input/output state (the
 * single biggest heap contributor) is released as soon as you leave it. Only a
 * few hundred bytes of UI preference survive (lib/prefs.ts).
 */
const toolComponent = computed(() => {
  if (route.value.name !== 'tool') return null
  const meta = findTool(route.value.id)
  return meta ? defineAsyncComponent(meta.load) : null
})

const activeTool = computed(() => (route.value.name === 'tool' ? findTool(route.value.id) ?? null : null))
const unknownTool = computed(() => route.value.name === 'tool' && !findTool(route.value.id))

watch(
  () => route.value,
  (current) => {
    if (current.name === 'home') document.title = 'Toolbox — offline developer utilities'
    else if (activeTool.value) document.title = `${activeTool.value.name} — Toolbox`
    if (current.name === 'tool' && activeTool.value) {
      const recent = prefs.getString('recentTools', prefs.getString('recentTool')).split(',')
      prefs.setString('recentTool', current.id)
      prefs.setString('recentTools', [current.id, ...recent.filter(id => id && id !== current.id)].slice(0, 4).join(','))
    }
    // Move focus off the previous tool's controls so keyboard users land somewhere predictable.
    window.scrollTo({ top: 0 })
  },
)
</script>

<template>
  <a class="skip-link" href="#main">Skip to content</a>

  <div class="app">
    <header class="topbar">
      <ToolMenu />
      <button class="brand" type="button" @click="goHome()" aria-label="Toolbox home">
        <svg class="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />
        </svg>
        <span>Toolbox</span>
      </button>
      <span class="topbar-sub">offline &amp; local-only</span>

      <button
        class="icon-btn"
        type="button"
        @click="onToggleTheme"
        :aria-pressed="theme === 'light'"
        :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        :title="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
      >
        <svg v-if="theme === 'dark'" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.8" fill="none" />
          <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <div v-if="updateReady" class="update-toast" role="status">
      <span>Update installed — reload to pick it up.</span>
      <button class="btn primary" type="button" @click="reload()">Reload</button>
      <button class="btn" type="button" @click="updateReady = false" aria-label="Dismiss update notice">Later</button>
    </div>

    <main class="content" id="main">
      <HomeView v-if="route.name === 'home'" />

      <template v-else-if="route.name === 'tool'">
        <nav class="crumb" aria-label="Breadcrumb">
          <button type="button" class="crumb-link" @click="goHome()">All tools</button>
          <span aria-hidden="true">/</span>
          <span class="crumb-here" aria-current="page">
            <svg v-if="activeTool" class="tool-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path :d="activeTool.icon" />
            </svg>
            {{ activeTool?.name ?? route.id }}
          </span>
        </nav>

        <p v-if="unknownTool" class="msg bad" role="alert">
          No tool called <code>{{ route.id }}</code>. It may not be implemented in this build — see the feature-parity
          checklist in the README.
        </p>
        <component :is="toolComponent" v-else :key="route.id" />
      </template>
    </main>

    <footer class="footer">
      <span>An original, DevToys-inspired toolbox. Not affiliated with, or endorsed by, the DevToys project.</span>
    </footer>
  </div>
</template>
