import { expect, test } from '@playwright/test'

// Samples from VERIFY_IN_BROWSER.md §1.
const XSD = `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="root">
    <xs:complexType><xs:sequence>
      <xs:element name="a" type="xs:integer"/>
    </xs:sequence></xs:complexType>
  </xs:element>
</xs:schema>`

test.describe('XML / XSD Tester (wasm validation)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('#/tool/xsd')
    await expect(page.getByRole('heading', { name: 'XML / XSD Tester' })).toBeVisible()
  })

  test('valid sample validates with zero errors', async ({ page }) => {
    await page.locator('#xsd-xml').fill('<root>\n  <a>1</a>\n</root>')
    await page.locator('#xsd-schema').fill(XSD)
    await page.getByRole('button', { name: 'Validate' }).click()
    const badge = page.locator('.badge.ok', { hasText: 'valid' })
    await expect(badge).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('The document satisfies the schema.')).toBeVisible()
  })

  test('invalid sample reports a schema error', async ({ page }) => {
    await page.locator('#xsd-xml').fill('<root><a>not-a-number</a></root>')
    await page.locator('#xsd-schema').fill(XSD)
    await page.getByRole('button', { name: 'Validate' }).click()
    const badge = page.locator('.badge.bad', { hasText: 'invalid' })
    await expect(badge).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.list-box')).toContainText(/integer|facet|not-a-number/i)
  })

  test('DOCTYPE is rejected by our guard before libxml2 runs', async ({ page }) => {
    await page.locator('#xsd-xml').fill('<!DOCTYPE root []><root/>')
    await page.locator('#xsd-schema').fill(XSD)
    await page.getByRole('button', { name: 'Validate' }).click()
    await expect(page.locator('.msg.bad')).toContainText(/DOCTYPE/, { timeout: 10_000 })
    // No valid/invalid verdict may appear for a rejected document.
    await expect(page.locator('.badge', { hasText: /^valid$/ })).toHaveCount(0)
  })
})
