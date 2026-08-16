import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-dark') {
    await page.addInitScript(() => localStorage.setItem('scientific-ui-theme', 'dark'))
  }
})

async function loadAndPreview(page: Page) {
  await page.goto('./')
  const load = page.getByRole('button', { name: 'Load example' })
  await expect(load).toBeEnabled()
  await load.click()
  await expect(page.getByRole('banner')).toContainText('Synthetic stack')
  await expect(page.locator('.scientific-header__context-value span')).toHaveAttribute('title', 'Synthetic stack · generated locally')
  await page.getByRole('button', { name: 'Preview model' }).click()
  await expect(page.getByRole('region', { name: 'Optical fit outcome' }).getByText('Preview current · not fitted')).toBeVisible()
}

async function expectNoPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
}

test('example preview stays distinct from a converged fit and has no runtime errors', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await loadAndPreview(page)
  if (testInfo.project.name === 'mobile-dark') await expect(page.locator('html')).toHaveAttribute('data-scientific-theme', 'g100')
  await expect(page.getByText('Fit converged')).toHaveCount(0)
  expect(await page.evaluate(() => ({ state: 'state' in window, simulation: 'simulation' in window }))).toEqual({ state: false, simulation: false })
  expect(errors).toEqual([])
})

test('initial and preview states have no serious accessibility violations or overflow', async ({ page }) => {
  await page.goto('./')
  let audit = await new AxeBuilder({ page }).exclude('canvas').analyze()
  expect(audit.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([])
  await loadAndPreview(page)
  const toolbar = page.getByRole('toolbar', { name: 'Plot controls' }).first()
  await expect(toolbar).toBeVisible()
  const toolbarRows = await toolbar.getByRole('button').evaluateAll((buttons) => new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top))).size)
  expect(toolbarRows).toBe(1)
  audit = await new AxeBuilder({ page }).exclude('canvas').analyze()
  expect(audit.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([])
  await expectNoPageOverflow(page)
})

test('configuration panels use one React control path and preserve stale results', async ({ page }) => {
  await loadAndPreview(page)

  await page.getByRole('button', { name: 'Layer stack', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Layer stack' })
  await expect(panel).toBeVisible()
  await page.waitForTimeout(300)
  await expect.poll(() => page.getByRole('toolbar', { name: 'Plot controls' }).first().locator('.modebar-btn path').evaluateAll((paths) => paths.every((path) => !path.getAttribute('style')?.includes('fill')))).toBe(true)
  await expect(panel.getByRole('combobox', { name: 'Optical model' })).toHaveValue('constant')
  const thickness = panel.getByRole('spinbutton', { name: 'Value Generic layer Film thickness' })
  await thickness.fill('175')
  await thickness.press('Tab')
  await panel.getByRole('button', { name: 'Close' }).click()

  await expect(page.getByText('Configuration changed. Preview the model or run a new fit; displayed results are stale.').first()).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()
  await page.getByRole('button', { name: 'Preview model' }).click()
  await expect(page.getByRole('region', { name: 'Optical fit outcome' }).getByText('Preview current · not fitted')).toBeVisible()
  await expectNoPageOverflow(page)
})

test('advanced layer controls, confirmation modal and keyboard closing remain operable', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Load example' }).click()
  await page.getByRole('button', { name: 'Layer stack', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Layer stack' })
  await panel.getByRole('tab', { name: 'Advanced' }).click()
  const modelGuide = panel.getByRole('button', { name: /Model guide/ }).first()
  await expect(modelGuide).toBeVisible()
  await modelGuide.click()
  await expect(panel.getByText('Typically represents').first()).toBeVisible()
  const geometry = await panel.evaluate((node) => {
    const body = node.querySelector<HTMLElement>('.configuration-panel-body')
    const add = [...node.querySelectorAll<HTMLElement>('button')].find((button) => button.textContent?.trim() === 'Add layer')
    const navigation = document.querySelector<HTMLElement>('.workflow-navigation')
    return {
      bodyOverflow: body ? body.scrollWidth - body.clientWidth : Number.POSITIVE_INFINITY,
      addLeft: add?.getBoundingClientRect().left ?? 0,
      navigationRight: navigation?.getBoundingClientRect().right ?? 0,
    }
  })
  expect(geometry.bodyOverflow).toBeLessThanOrEqual(1)
  if ((page.viewportSize()?.width ?? 0) >= 1056) expect(geometry.addLeft).toBeGreaterThanOrEqual(geometry.navigationRight)

  await panel.getByRole('button', { name: 'Add layer' }).click()
  await panel.getByRole('button', { name: 'Remove Generic layer' }).click()
  const dialog = page.getByRole('dialog', { name: 'Remove Generic layer?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()

  await panel.press('Escape')
  await expect(panel).toBeHidden()
  await expect(page.getByRole('button', { name: 'Layer stack', exact: true })).toBeFocused()
  await expectNoPageOverflow(page)
})

test('invalid processing settings surface a React error notification', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Load example' }).click()
  await page.getByRole('button', { name: 'Data', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Measurement' })
  await panel.getByRole('tab', { name: 'Advanced' }).click()
  const minimum = panel.getByRole('spinbutton', { name: 'Minimum λ' })
  await minimum.fill('1200')
  await minimum.press('Tab')
  await panel.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Preview model' }).click()
  await expect(page.getByText('The calculation needs attention')).toBeVisible()
  await expect(page.getByText(/wavelength/i).last()).toBeVisible()
  await expectNoPageOverflow(page)
})

test('a reduced fit completes and enables uncertainty and export actions', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-light', 'One desktop fit covers the worker integration without duplicating the scientific workload.')
  await page.goto('./')
  await page.getByRole('button', { name: 'Load example' }).click()
  await page.getByRole('button', { name: 'Fit', exact: true }).last().click()
  const panel = page.getByRole('complementary', { name: 'Fit' })
  await panel.getByRole('tab', { name: 'Advanced' }).click()
  await panel.getByRole('combobox', { name: 'Sobol points' }).selectOption('64')
  const refinements = panel.getByRole('spinbutton', { name: 'Local refinements' })
  await refinements.fill('1')
  await refinements.press('Tab')
  await panel.getByRole('button', { name: 'Run fit' }).click()

  await expect(page.getByText('Fit converged').first()).toBeVisible({ timeout: 30_000 })
  await expect(panel.getByRole('button', { name: 'Estimate bootstrap uncertainty' })).toBeEnabled()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('button', { name: 'Export results' })).toBeEnabled()
  await page.getByRole('tab', { name: 'Fit quality' }).click()
  await expect(page.getByRole('heading', { name: 'Diagnostics' })).toBeVisible()
  await page.getByRole('tab', { name: 'Optical n,k' }).click()
  await expect(page.getByRole('heading', { name: 'Complex refractive index' })).toBeVisible()
})
