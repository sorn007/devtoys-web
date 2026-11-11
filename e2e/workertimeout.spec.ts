import { expect, test } from '@playwright/test'

// VERIFY_IN_BROWSER.md §2 — the 10 s worker timeout must fire for a
// catastrophic-backtracking regex, the page must stay responsive, and a fresh
// worker must be recreated afterwards.
test('worker timeout: terminates, page stays responsive, worker recreated', async ({ page }) => {
  await page.goto('#/tool/regex')
  await expect(page.getByRole('heading', { name: 'Regex Tester' })).toBeVisible()

  const started = Date.now()
  await page.getByLabel('Regular expression').fill('(a+)+$')
  await page.locator('#re-text').fill('a'.repeat(31) + 'b')

  // While the worker spins, the UI thread must still respond: type in the pattern field.
  const patternBox = page.getByLabel('Regular expression')
  await expect(patternBox).toBeEditable()
  await patternBox.pressSequentially(' ', { delay: 5 }) // still typing works
  await patternBox.press('Backspace')

  // The timeout error appears within ~10–13 s of the evaluation starting.
  await expect(page.locator('.msg.bad')).toContainText(/timed out/i, { timeout: 13_000 })
  const elapsed = Date.now() - started
  // It must not have failed instantly (that would mean a different error path).
  expect(elapsed).toBeGreaterThan(5_000)

  // Worker recreation: a trivial regex evaluates successfully on the SAME page.
  await page.getByLabel('Regular expression').fill('a+')
  await page.locator('#re-text').fill('aaa')
  await expect(page.locator('.badge', { hasText: '1 match' })).toBeVisible({ timeout: 10_000 })
})
