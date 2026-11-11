import { onBeforeUnmount } from 'vue'

/**
 * Per-component object-URL registry. Every createObjectURL goes through here
 * so unmount reliably revokes them — an unrevoke()'d blob URL pins its bytes
 * until the document goes away, which is exactly the leak this prevents.
 */
export function useObjectUrls() {
  const urls = new Set<string>()

  function create(blob: Blob): string {
    const url = URL.createObjectURL(blob)
    urls.add(url)
    return url
  }

  function revoke(url: string): void {
    URL.revokeObjectURL(url)
    urls.delete(url)
  }

  function revokeAll(): void {
    for (const url of urls) URL.revokeObjectURL(url)
    urls.clear()
  }

  onBeforeUnmount(revokeAll)

  return { create, revoke, revokeAll }
}
