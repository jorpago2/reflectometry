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
  const zoom = toolbar.getByRole('button', { name: 'Zoom', exact: true })
  const pan = toolbar.getByRole('button', { name: 'Pan' })
  const fullscreen = toolbar.getByRole('button', { name: 'Toggle fullscreen' })
  await expect(zoom).toHaveAttribute('aria-pressed', 'false')
  await expect(pan).toHaveAttribute('aria-pressed', 'true')
  await zoom.click()
  await expect(zoom).toHaveAttribute('aria-pressed', 'true')
  await expect(pan).toHaveAttribute('aria-pressed', 'false')
  await fullscreen.click()
  await expect(fullscreen).toHaveAttribute('aria-pressed', 'true')
  await fullscreen.press('Escape')
  await expect(fullscreen).toHaveAttribute('aria-pressed', 'false')
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
    const definition = node.querySelector<HTMLElement>('.model-guide__body dd')
    return {
      bodyOverflow: body ? body.scrollWidth - body.clientWidth : Number.POSITIVE_INFINITY,
      addLeft: add?.getBoundingClientRect().left ?? 0,
      definitionWidth: definition?.getBoundingClientRect().width ?? 0,
      navigationRight: navigation?.getBoundingClientRect().right ?? 0,
    }
  })
  expect(geometry.bodyOverflow).toBeLessThanOrEqual(1)
  expect(geometry.definitionWidth).toBeGreaterThan(120)
  if ((page.viewportSize()?.width ?? 0) >= 1056) expect(geometry.addLeft).toBeGreaterThanOrEqual(geometry.navigationRight)

  await panel.getByRole('button', { name: 'Add layer' }).click()
  const removeTrigger = panel.getByRole('button', { name: 'Remove Generic layer' })
  await removeTrigger.click()
  const dialog = page.getByRole('dialog', { name: 'Remove Generic layer?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).press('Escape')
  await expect(dialog).toBeHidden()
  await expect(removeTrigger).toBeFocused()
  await expect(panel).toBeVisible()

  await panel.press('Escape')
  await expect(panel).toBeHidden()
  await expect(page.getByRole('button', { name: 'Layer stack', exact: true })).toBeFocused()
  await expectNoPageOverflow(page)
})

test('shared configuration rail preserves expanded state and keyboard navigation', async ({ page }) => {
  await page.goto('./')
  const navigation = page.getByRole('navigation', { name: 'Configuration tools' })
  const data = navigation.getByRole('button', { name: 'Data', exact: true })
  const layers = navigation.getByRole('button', { name: 'Layer stack', exact: true })
  const fit = navigation.getByRole('button', { name: 'Fit', exact: true })
  await expect(navigation.getByRole('button')).toHaveCount(3)

  await data.focus()
  await data.press('ArrowRight')
  await expect(layers).toBeFocused()
  await layers.press('Enter')
  await expect(layers).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('complementary', { name: 'Layer stack' })).toBeVisible()
  await layers.press('End')
  await expect(fit).toBeFocused()
  await fit.press('Enter')
  await expect(fit).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('complementary', { name: 'Fit' })).toBeVisible()
  await fit.press('Escape')
  await expect(page.getByRole('complementary', { name: 'Fit' })).toBeHidden()
  await expect(fit).toBeFocused()
})

test('invalid processing settings surface a React error notification', async ({ page }) => {
  await loadAndPreview(page)
  await page.getByRole('button', { name: 'Data', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Measurement' })
  await panel.getByRole('tab', { name: 'Advanced' }).click()
  const minimum = panel.getByRole('spinbutton', { name: 'Minimum λ' })
  await minimum.fill('1200')
  await minimum.press('Tab')
  await panel.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Preview model' }).click()
  await expect(page.getByText('The calculation needs attention')).toBeVisible()
  await expect(page.getByText('The wavelength range, bin width, and SNR must be valid.', { exact: true }).first()).toBeVisible()
  const outcomeGeometry = await page.locator('.reflectometry-outcome').evaluate((node) => {
    const status = node.querySelector<HTMLElement>('.scientific-status')
    return {
      outcomeOverflow: node.scrollWidth - node.clientWidth,
      statusOverflow: status ? status.scrollWidth - status.clientWidth : Number.POSITIVE_INFINITY,
    }
  })
  expect(outcomeGeometry.outcomeOverflow).toBeLessThanOrEqual(1)
  expect(outcomeGeometry.statusOverflow).toBeLessThanOrEqual(1)
  await expectNoPageOverflow(page)
})

test('switching configuration tools resets the owned panel scroll', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Load example' }).click()
  await page.getByRole('button', { name: 'Layer stack', exact: true }).click()
  const layerPanel = page.getByRole('complementary', { name: 'Layer stack' })
  await layerPanel.getByRole('tab', { name: 'Advanced' }).click()
  await layerPanel.getByRole('button', { name: /Model guide/ }).first().click()
  await layerPanel.getByRole('heading', { name: 'Parameters in this material' }).first().scrollIntoViewIfNeeded()
  expect(await layerPanel.locator('.configuration-panel-body').evaluate((node) => node.scrollTop)).toBeGreaterThan(0)

  await page.getByRole('navigation', { name: 'Configuration tools' }).getByRole('button', { name: 'Fit', exact: true }).click()
  const fitPanel = page.getByRole('complementary', { name: 'Fit' })
  await expect(fitPanel).toBeVisible()
  expect(await fitPanel.locator('.configuration-panel-body').evaluate((node) => node.scrollTop)).toBe(0)
})

test('measurement file selections survive switching configuration tools', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Data', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Measurement' })
  await panel.getByRole('button', { name: 'Load measurement files' }).click()
  await panel.locator('#file-sample-r').setInputFiles({
    name: 'sample-r.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('400 1\n500 1\n'),
  })
  await expect(panel.getByText('sample-r.txt', { exact: true })).toBeVisible()

  await page.getByRole('navigation', { name: 'Configuration tools' }).getByRole('button', { name: 'Layer stack', exact: true }).click()
  await page.getByRole('navigation', { name: 'Configuration tools' }).getByRole('button', { name: 'Data', exact: true }).click()
  await expect(panel.getByText('sample-r.txt', { exact: true })).toBeVisible()
})

test('docked configuration panel does not cover result actions at an intermediate desktop width', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-light', 'The docked intermediate layout only applies to desktop.')
  await page.setViewportSize({ width: 1280, height: 720 })
  await loadAndPreview(page)
  await page.getByRole('button', { name: 'Layer stack', exact: true }).click()

  const geometry = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('.results')
    const actions = [...document.querySelectorAll<HTMLElement>('.reflectometry-outcome .scientific-command-bar__action')]
    return {
      stageLeft: stage?.getBoundingClientRect().left ?? Number.POSITIVE_INFINITY,
      actionLeft: Math.min(...actions.map((action) => action.getBoundingClientRect().left)),
    }
  })
  expect(geometry.actionLeft).toBeGreaterThanOrEqual(geometry.stageLeft)
})

test('320px results keep readable tabs and a single-row essential plot toolbar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-dark', 'The narrow result layout only applies to mobile.')
  await page.setViewportSize({ width: 320, height: 568 })
  await loadAndPreview(page)

  const tabs = page.getByRole('tablist', { name: 'Result views' }).getByRole('tab')
  await expect(tabs).toHaveCount(3)
  const truncatedTabs = await tabs.evaluateAll((items) => items.filter((item) => item.scrollWidth > item.clientWidth + 1).length)
  expect(truncatedTabs).toBe(0)

  const toolbar = page.locator('.plot-card').first().locator('.modebar')
  await expect(toolbar).toBeVisible()
  const toolbarRows = await toolbar.getByRole('button').evaluateAll((buttons) => new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top))).size)
  expect(toolbarRows).toBe(1)
})

test('mobile results keep one scroll owner, visible actions and fitted tabs', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-dark', 'The compact shell only applies to the mobile project.')
  await loadAndPreview(page)

  const tabGeometry = await page.getByRole('tablist', { name: 'Result views' }).evaluate((node) => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }))
  expect(tabGeometry.scrollWidth - tabGeometry.clientWidth).toBeLessThanOrEqual(1)
  await expect(page.getByRole('button', { name: 'Export results' })).toBeVisible()

  const layout = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: document.documentElement.clientHeight,
    metricRows: new Set([...document.querySelectorAll('.reflectometry-outcome .scientific-metric')].map((node) => Math.round(node.getBoundingClientRect().top))).size,
  }))
  expect(layout.documentHeight - layout.viewportHeight).toBeLessThanOrEqual(1)
  expect(layout.metricRows).toBe(1)
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
