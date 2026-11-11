// Applies the stored theme before first paint (no flash of wrong theme).
// External file: the CSP's script-src 'self' forbids inline scripts, and the
// bootstrap must run before the app bundle paints.
try {
  var t = JSON.parse(localStorage.getItem('toolbox.prefs.v1') || '{}').theme
  if (t !== 'light' && t !== 'dark') t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  document.documentElement.dataset.theme = t
} catch (e) {
  document.documentElement.dataset.theme = 'dark'
}
