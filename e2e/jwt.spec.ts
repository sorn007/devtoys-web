import { expect, test } from '@playwright/test'

/**
 * The token below was built with the same UTF-8 → base64url pipeline the app
 * now uses (TextEncoder bytes, not btoa of a non-ASCII string):
 *   header  {"alg":"HS256","typ":"JWT"}
 *   payload {"name":"สมชาย","e":"😀"}
 * (verified against `node -e "Buffer.from(JSON.stringify(...)).toString('base64url')"`).
 */
const TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoi4Liq4Lih4LiK4Liy4LiiIiwiZSI6IvCfmIAifQ.sig-not-checked'

test('JWT decoder renders Thai and emoji claims without mojibake', async ({ page }) => {
  await page.goto('#/tool/jwt')
  await expect(page.getByRole('heading', { name: 'JWT Decoder' })).toBeVisible()

  await page.fill('#jwt-in', TOKEN)

  // The payload pane must show the real characters, not Latin-1 mojibake
  // ('à¸ª…') and not U+FFFD replacement characters.
  const payloadPane = page.locator('.pane', { hasText: 'Payload claims' })
  await expect(payloadPane.locator('dd').filter({ hasText: 'สมชาย' })).toBeVisible()
  await expect(payloadPane.locator('dd').filter({ hasText: '😀' })).toBeVisible()
  await expect(payloadPane).not.toContainText('�')
  await expect(payloadPane).not.toContainText('à¸')

  // The header pane decodes too — the whole token must have parsed.
  await expect(page.locator('.pane', { hasText: 'Header' }).locator('dd').first()).toContainText('HS256')
})
