import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function loadAndPreview(page: Page) {
  await page.goto('./')
  const load = page.getByRole('button', { name: 'Load example' })
  await expect(load).toBeEnabled()
  await load.click()
  await expect(page.getByRole('banner')).toContainText('Synthetic stack · generated locally')
  await page.getByRole('button', { name: 'Preview model' }).click()
  await expect(page.getByRole('region', { name: 'Optical fit outcome' }).getByText('Preview current · not fitted')).toBeVisible()
}

test('example preview stays distinct from a converged fit and has no runtime errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await loadAndPreview(page)
  await expect(page.getByText('Fit converged')).toHaveCount(0)
  expect(await page.evaluate(() => ({ state: 'state' in window, simulation: 'simulation' in window }))).toEqual({ state: false, simulation: false })
  expect(errors).toEqual([])
})

test('initial and preview states have no serious accessibility violations or overflow', async ({ page }) => {
  await page.goto('./')
  let audit = await new AxeBuilder({ page }).exclude('canvas').analyze()
  expect(audit.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([])
  await loadAndPreview(page)
  audit = await new AxeBuilder({ page }).exclude('canvas').analyze()
  expect(audit.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})
