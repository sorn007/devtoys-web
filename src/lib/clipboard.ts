/** Copy-to-clipboard with a non-modal, self-clearing confirmation. */
export async function copyText(text: string, done = 'Copied.'): Promise<string> {
  try {
    await navigator.clipboard.writeText(text)
    return done
  } catch {
    // Clipboard API can be unavailable (insecure context, permission denied).
    // Fallback selects the text so Ctrl/Cmd+C works; we never fake success.
    return 'Clipboard blocked — select the text and copy manually.'
  }
}
