import { expect, test } from '@playwright/test'

// VERIFY_IN_BROWSER.md §4 — after SW activation, precached tools work offline;
// the XSD tool degrades gracefully offline when the wasm was never cached.
test('offline: precached tool works; XSD wasm path fails gracefully', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByPlaceholder(/Search tools/)).toBeVisible()

  // Wait until the service worker controls this page (precache installed).
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20_000 })

  // --- Precached tool: Certificate Decoder (11.2 kB chunk, no heavy deps).
  await page.goto('#/tool/certificate')
  await expect(page.getByRole('heading', { name: 'Certificate Decoder' })).toBeVisible()

  // Fresh-offline XSD: never visited online in THIS context, so the wasm is
  // not in the runtime cache. Go offline BEFORE first touching the XSD tool.
  await context.setOffline(true)
  // Reload keeps the hash, so we land on the Certificate tool again — served
  // by the service worker from the precache, with no network.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Certificate Decoder' })).toBeVisible({ timeout: 20_000 })

  await page.goto('#/tool/certificate')
  const pem = (await page.evaluate(() => true)) // shell alive after offline reload
  expect(pem).toBe(true)

  // Certificate tool must still produce a result offline (precached chunk).
  await page.locator('#cert-in').fill('garbage-not-a-certificate')
  await expect(page.locator('.msg.bad')).toContainText(/PEM|base64|DER/i)

  // XSD offline, wasm never fetched: the tool loads and reports an error
  // instead of crashing the page.
  await page.goto('#/tool/xsd')
  await expect(page.getByRole('heading', { name: 'XML / XSD Tester' })).toBeVisible({ timeout: 15_000 })
  await page.locator('#xsd-xml').fill('<root><a>1</a></root>')
  await page.locator('#xsd-schema').fill('<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"/>')
  await page.getByRole('button', { name: 'Validate' }).click()
  await expect(page.locator('.msg.bad')).toBeVisible({ timeout: 20_000 })
  // The page is still alive (no crash): the search affordance still responds.
  await page.goto('#/')
  await expect(page.getByPlaceholder(/Search tools/)).toBeVisible()

  await context.setOffline(false)
  await context.close()
})
