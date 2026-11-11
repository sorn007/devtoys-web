import { expect, test } from '@playwright/test'
import { writeFileSync } from 'node:fs'

// VERIFY_IN_BROWSER.md §5 (optional) — capture real heap numbers via CDP.
// Raw values are written to RAM_MEASUREMENTS.md by the test itself; see that
// file for caveats (headless Chromium, single run, no marketing claims).
test('capture JS heap across tool visits', async ({ page }) => {
  const session = await page.context().newCDPSession(page)
  await session.send('Performance.enable')
  const heap = async () => {
    const { metrics } = await session.send('Performance.getMetrics')
    const used = metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? -1
    return Number(used)
  }
  const fmt = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`

  await page.goto('/')
  await expect(page.getByPlaceholder(/Search tools/)).toBeVisible()
  await page.waitForTimeout(1_500) // let the shell settle
  const home = await heap()

  // Open five tools in turn, returning home between each.
  const tools = ['json', 'yaml', 'diff', 'regex', 'certificate']
  for (const id of tools) {
    await page.goto(`#/tool/${id}`)
    await page.waitForTimeout(600)
    await page.goto('#/')
    await page.waitForTimeout(200)
  }
  const afterCycling = await heap()

  // One tool open at the end (a heavier one).
  await page.goto('#/tool/xsd')
  await page.waitForTimeout(600)
  const withXsdOpen = await heap()

  const report = [
    `Measured ${new Date().toISOString()} by e2e/ram.spec.ts (Playwright, headless Chromium, CDP Performance.getMetrics):`,
    ``,
    `| checkpoint | JSHeapUsedSize |`,
    `|---|---|`,
    `| home, cold | ${fmt(home)} |`,
    `| home, after cycling 5 tools (returned home between each) | ${fmt(afterCycling)} |`,
    `| XML/XSD tool open | ${fmt(withXsdOpen)} |`,
  ].join('\n')
  writeFileSync('RAM_MEASUREMENTS.md', report + '\n')
  expect(home).toBeGreaterThan(0)
})
