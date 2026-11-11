import { readonly, ref, type Ref } from 'vue'

/**
 * Minimal hash router (~50 lines) instead of vue-router. Reasons, since a
 * dependency would otherwise look simpler:
 * - the app has exactly two routes (tool list, tool view) and no nested routes,
 *   history manipulation or route guards;
 * - hash routing works from `file://` and any static host with no rewrites;
 * - it keeps the vendor bundle at exactly one runtime dependency (vue).
 *
 * If navigation guards or nested routes are ever needed, swap this for
 * vue-router — nothing outside this file and App.vue touches it.
 */

export type Route = { name: 'home' } | { name: 'tool'; id: string }

function parse(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '')
  if (clean.startsWith('tool/')) {
    const id = decodeURIComponent(clean.slice('tool/'.length))
    if (id) return { name: 'tool', id }
  }
  return { name: 'home' }
}

const current: Ref<Route> = ref(parse(typeof location === 'undefined' ? '' : location.hash))

function apply(): void {
  current.value = parse(location.hash)
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', apply)
}

export const route = readonly(current) as Readonly<Ref<Route>>

export function navigate(to: Route): void {
  const hash = to.name === 'home' ? '#/' : `#/tool/${encodeURIComponent(to.id)}`
  if (location.hash === hash) return
  location.hash = hash
}

export function goHome(): void {
  navigate({ name: 'home' })
}
