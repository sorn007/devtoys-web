import { prefs } from './prefs'

/**
 * Theme handling. Dark is the default (developer tool, OLED-friendly); the
 * choice is remembered in the capped prefs store and applied as a single
 * `data-theme` attribute on <html> so CSS custom properties do the rest.
 * No flash-of-wrong-theme: index.html applies the stored choice before the
 * app bundle is parsed.
 */

export type Theme = 'dark' | 'light'
const KEY = 'theme'

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  // Keeps the browser chrome and taskbar accent in step with the app.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0f17' : '#f5f7fb')
}

export function currentTheme(): Theme {
  const stored = prefs.getString(KEY)
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function setTheme(theme: Theme): void {
  prefs.setString(KEY, theme)
  applyTheme(theme)
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}
