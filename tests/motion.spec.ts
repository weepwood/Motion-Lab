import { expect, test } from '@playwright/test'

test('message flight settles and leaves visible bubble', async ({ page }) => {
  await page.goto('/')
  const input = page.getByRole('textbox', {name:'消息内容'})
  await input.fill('自动化测试发送轨迹')
  await input.press('Enter')
  await expect(page.getByText('自动化测试发送轨迹', {exact:true})).toBeVisible()
  await expect(page.locator('.flight-ghost')).toHaveCount(0, {timeout:5000})
  await expect(page.locator('.bubble.is-pending')).toHaveCount(0)
})

test('anchored context menu stays inside viewport and closes', async ({ page }) => {
  await page.setViewportSize({width:900,height:650})
  await page.goto('/')
  await page.locator('.bubble').last().click({button:'right'})
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const box = await menu.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x+box!.width).toBeLessThanOrEqual(902)
  expect(box!.y+box!.height).toBeLessThanOrEqual(652)
  expect(await menu.evaluate(el=>getComputedStyle(el).transformOrigin)).not.toBe('')
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
})

test('theme choice persists through reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button',{name:'深色',exact:true}).click()
  await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/)
  await page.reload()
  await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/)
  await page.getByRole('button',{name:'浅色',exact:true}).click()
  await expect(page.locator('.app-shell')).toHaveClass(/theme-light/)
})

test('rapid chat switches and multiple sends clean up animations', async ({ page }) => {
  await page.goto('/')
  const first = page.getByRole('button',{name:/Motion Design/})
  const second = page.getByRole('button',{name:/Alex Chen/})
  for(let i=0;i<12;i++) {
    await second.click()
    await first.click()
  }
  const input = page.getByRole('textbox',{name:'消息内容'})
  await input.fill('快速测试消息')
  await input.press('Enter')
  await first.click()
  await expect(page.locator('.flight-ghost')).toHaveCount(0,{timeout:5000})
  await expect(page.locator('.bubble.is-pending')).toHaveCount(0)
})

test('500 messages are kept in bounded DOM and older messages can be loaded', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button',{name:/压力测试/}).click()
  await expect(page.locator('.message-row')).toHaveCount(120)
  const load = page.getByRole('button',{name:/查看更早的/})
  await expect(load).toBeVisible()
  await load.click()
  await expect(page.locator('.message-row')).toHaveCount(240)
})

test('reduced motion keeps sending functional', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto('/')
  const input = page.getByRole('textbox',{name:'消息内容'})
  await input.fill('减少动效仍可发送')
  await input.press('Enter')
  await expect(page.getByText('减少动效仍可发送',{exact:true})).toBeVisible()
  await expect(page.locator('.flight-ghost')).toHaveCount(0)
})
