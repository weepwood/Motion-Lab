import { expect, test, type Page } from '@playwright/test'

/**
 * CI gate 2 — the zero-build demo page exercises every motion-kit export for
 * real (imports, ripples, flights, gestures, tokens and levels). Any console
 * error fails the build.
 */

const errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors.length = 0
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(String(e)))
})

test.afterEach(() => {
  expect(errors, 'demo page must not produce console errors\n' + errors.join('\n')).toEqual([])
})

async function open(page: Page) {
  await page.goto('/demo/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('motion-kit')
}

test('every demo card renders', async ({ page }) => {
  await open(page)
  await expect(page.locator('.card')).toHaveCount(8)
})

test('dual-curve flight lands and interruption never leaks clones', async ({ page }) => {
  await open(page)
  const btn = page.getByRole('button', { name: '发送（快照飞行）' })
  await btn.click()
  // Sending again mid-flight must interrupt the first flight, not stack on it.
  await page.waitForTimeout(120)
  await btn.click()
  await expect.poll(() => page.locator('.mk-flight').count(), { timeout: 4000 }).toBe(0)
  await expect(page.locator('#flyTarget.on')).toBeVisible()
})

test('parabola flight reveals its landing early', async ({ page }) => {
  await open(page)
  await page.locator('.para-palette button').first().click()
  await expect(page.locator('#paraTarget.on')).toBeVisible({ timeout: 3000 })
})

test('ripple listens to the token bridge', async ({ page }) => {
  await open(page)
  await page.locator('#ripPill').click({ position: { x: 30, y: 20 } })
  await expect(page.locator('#ripPill span span')).toHaveCount(1)
  // Duration is read from CSS at press time: shrinking the token shrinks the wave life.
  await page.evaluate(() => document.documentElement.style.setProperty('--mk-ripple-duration', '40ms'))
  await page.locator('#ripPill').click({ position: { x: 60, y: 20 } })
  await expect.poll(() => page.locator('#ripPill span span').count()).toBeLessThan(2)
})

test('swipe gesture reports damped progress and threshold state', async ({ page }) => {
  await open(page)
  const card = page.locator('#swipeCard')
  const box = (await card.boundingBox())!
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width - 20, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 100, y, { steps: 14 })
  await page.mouse.up()
  await expect(page.locator('#swipeState')).toContainText('触发')
})

test('animation levels drive the token system', async ({ page }) => {
  await open(page)
  await page.locator('#levelSeg button[data-lv="1"]').click()
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--mk-dur-move').trim())).toBe('0ms')
  await page.locator('#fadeBtn').click()
  await expect.poll(() => page.evaluate(() => document.getElementById('fadeBox').style.opacity)).toBe('1')
  await page.locator('#levelSeg button[data-lv="0"]').click()
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--mk-dur-menu').trim())).toBe('0ms')
  await page.locator('#levelSeg button[data-lv="2"]').click()
})

test('scroll anchoring keeps the viewport pinned on prepend', async ({ page }) => {
  await open(page)
  const demo = page.locator('#scrollDemo')
  await demo.evaluate(el => { el.scrollTop = 240 })
  const pinned = await demo.evaluate(el => {
    const box = el.getBoundingClientRect()
    const row = [...el.querySelectorAll('.mk-anchor-row')].find(r => r.getBoundingClientRect().bottom >= box.top)
    return { key: row?.dataset.anchor, offset: row ? row.getBoundingClientRect().top - box.top : 0 }
  })
  expect(pinned.key).toBeTruthy()
  await page.getByRole('button', { name: '向前插入 20 行' }).click()
  await expect.poll(() => demo.evaluate((el, key) => {
    const row = el.querySelector(`[data-anchor="${key}"]`)
    if (!row) return NaN
    return row.getBoundingClientRect().top - el.getBoundingClientRect().top
  }, pinned.key)).toBeCloseTo(pinned.offset, 0)
})
