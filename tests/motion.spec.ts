import { expect, test, type Page } from '@playwright/test'

const list = (page: Page) => page.locator('.message-list')

async function openFromMainMenu(page: Page, item: string) {
  await page.getByRole('button', { name: '打开主菜单' }).click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
  await expect(page.getByRole('region', { name: '设置面板' })).toBeVisible()
}

/**
 * 设置页的 tab 用 Transition 叠层：转场期间上一屏仍在 DOM 里，也带着自己的
 * “返回”按钮。作用域限定在面板内并取最后一个，避免 strict 模式下命中两个。
 */
function backButton(page: Page) {
  return page.getByRole('region', { name: '设置面板' })
    .getByRole('button', { name: '返回', exact: true }).last()
}

test('messenger layout loads; settings slide in inside the left column and close again', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.workspace')).toBeVisible()
  await expect(page.locator('.settings')).toHaveCount(0)
  await page.getByRole('button', { name: '打开动效设置' }).click()
  const panel = page.getByRole('region', { name: '设置面板' })
  await expect(panel.getByRole('heading', { name: '动画与省电', exact: true })).toBeVisible()
  await panel.getByRole('button', { name: '返回', exact: true }).click()
  await expect(panel.getByRole('heading', { name: '设置', exact: true })).toBeVisible()
  await panel.getByRole('button', { name: '关闭设置', exact: true }).click()
  await expect(page.locator('.settings')).toHaveCount(0)
  await expect(page.locator('.chat-entry').filter({ hasText: 'Motion Design' })).toBeVisible()
})

test('message flight settles and leaves a visible bubble', async ({ page }) => {
  await page.goto('/')
  const input = page.getByRole('textbox', { name: '消息内容' })
  await input.fill('自动化测试发送轨迹')
  await input.press('Enter')
  await expect(page.locator('.flight-layer')).toHaveCount(0, { timeout: 5000 })
  await expect(list(page).locator('.bubble-text').filter({ hasText: '自动化测试发送轨迹' })).toBeVisible()
  await expect(page.locator('.message-row.flying')).toHaveCount(0)
})

test('anchored context menu stays inside the viewport and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 650 })
  await page.goto('/')
  await list(page).locator('.bubble').last().click({ button: 'right' })
  const menu = page.locator('.msg-menu')
  await expect(menu).toBeVisible()
  const box = await menu.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(902)
  expect(box!.y + box!.height).toBeLessThanOrEqual(652)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
})

test('theme choice persists through reload', async ({ page }) => {
  await page.goto('/')
  await openFromMainMenu(page, '设置')
  await page.getByRole('button', { name: /通用设置/ }).click()
  await page.getByText('夜间', { exact: true }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/)
  await page.waitForTimeout(250)
  await page.reload()
  await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/)
  await openFromMainMenu(page, '设置')
  await page.getByRole('button', { name: /通用设置/ }).click()
  await page.getByText('日间', { exact: true }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/theme-light/)
})

test('motion settings change real CSS variables and persist', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '打开动效设置' }).click()
  await page.locator('#duration').fill('500')
  await page.getByRole('radio', { name: '弹簧' }).click()
  const shell = page.locator('.app-shell')
  await expect.poll(() => shell.evaluate(el => getComputedStyle(el).getPropertyValue('--dur-send').trim())).toBe('500ms')
  await expect.poll(() => shell.evaluate(el => getComputedStyle(el).getPropertyValue('--ease'))).toMatch(/linear\(|cubic-bezier/)
  await page.waitForTimeout(250)
  await page.reload()
  await page.getByRole('button', { name: '打开动效设置' }).click()
  await expect(page.locator('.group-caption').filter({ hasText: '基础时长' })).toContainText('500 ms')
})

test('turning the animation level off sends without a flight', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '打开动效设置' }).click()
  await page.getByRole('radiogroup', { name: '动画等级' }).getByRole('radio', { name: '关闭' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/motion-off/)
  const input = page.getByRole('textbox', { name: '消息内容' })
  await input.fill('无动画发送')
  await input.press('Enter')
  await expect(page.locator('.flight-layer')).toHaveCount(0)
  await expect(list(page).getByText('无动画发送', { exact: true })).toBeVisible()
})

test('animation level 1 degrades to fades: displacement collapses, menus keep fading', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '打开动效设置' }).click()
  await page.getByRole('radiogroup', { name: '动画等级' }).getByRole('radio', { name: '降级' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/anim-level-1/)
  const shell = page.locator('.app-shell')
  // Movement durations collapse to 0 (tweb animation-level-1), fade durations survive.
  await expect.poll(() => shell.evaluate(el => getComputedStyle(el).getPropertyValue('--dur-menu-move').trim())).toBe('0ms')
  await expect.poll(() => shell.evaluate(el => Number.parseFloat(getComputedStyle(el).getPropertyValue('--dur-menu')) || 0)).toBeGreaterThan(0)
  // Displacement-only categories (send flight) are switched off entirely at level 1.
  await expect.poll(() => shell.evaluate(el => getComputedStyle(el).getPropertyValue('--dur-send').trim())).toBe('0ms')
})

test('telegram preset applies measured tweb values and persists', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '打开动效设置' }).click()
  await page.getByRole('button', { name: /Telegram 官方手感/ }).click()
  const shell = page.locator('.app-shell')
  // tweb tokens: .2s menus, 600 ms night reveal (7s ripple comes from the same store).
  await expect.poll(() => shell.evaluate(el => getComputedStyle(el).getPropertyValue('--dur-menu').trim())).toBe('200ms')
  await expect.poll(() => shell.evaluate(el => getComputedStyle(el).getPropertyValue('--dur-themeReveal').trim())).toBe('600ms')
  await page.waitForTimeout(250)
  await page.reload()
  await expect.poll(() => shell.evaluate(el => getComputedStyle(el).getPropertyValue('--dur-menu').trim())).toBe('200ms')
})

test('per-category duration override drives the real CSS variable', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '打开动效设置' }).click()
  await page.getByRole('radio', { name: '菜单与弹窗', exact: true }).click()
  await page.getByText('时长覆盖', { exact: true }).click()
  await page.getByLabel('菜单与弹窗 时长覆盖').fill('300')
  const shell = page.locator('.app-shell')
  await expect.poll(() => shell.evaluate(el => getComputedStyle(el).getPropertyValue('--dur-menu').trim())).toBe('300ms')
  await page.waitForTimeout(250)
  await page.reload()
  await expect.poll(() => shell.evaluate(el => getComputedStyle(el).getPropertyValue('--dur-menu').trim())).toBe('300ms')
})

test('rapid chat switches and multiple sends clean up animations', async ({ page }) => {
  await page.goto('/')
  const first = page.locator('.chat-entry').filter({ hasText: 'Motion Design' })
  const second = page.locator('.chat-entry').filter({ hasText: 'Alex Chen' })
  for (let i = 0; i < 12; i++) {
    await second.click()
    await first.click()
  }
  const input = page.getByRole('textbox', { name: '消息内容' })
  await input.fill('快速测试消息')
  await input.press('Enter')
  await second.click()
  await first.click()
  await expect(page.locator('.flight-layer')).toHaveCount(0, { timeout: 5000 })
  await expect(page.locator('.message-row.flying')).toHaveCount(0)
})

test('swipe left on a bubble starts a reply that is quoted in the sent message', async ({ page }) => {
  await page.goto('/')
  const bubble = list(page).locator('.message-row.incoming .bubble').last()
  const box = (await bubble.boundingBox())!
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width - 10, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 110, y, { steps: 12 })
  await page.mouse.up()
  await expect(page.locator('.reply-bar')).toBeVisible()
  const input = page.getByRole('textbox', { name: '消息内容' })
  await input.fill('带引用的回复')
  await input.press('Enter')
  const sent = list(page).locator('.message-row.mine').filter({ hasText: '带引用的回复' })
  await expect(sent.locator('.bubble-reply')).toBeVisible()
})

test('delete from the context menu removes the message', async ({ page }) => {
  await page.goto('/')
  const rows = list(page).locator('.message-row')
  const before = await rows.count()
  await list(page).locator('.bubble').last().click({ button: 'right' })
  await page.getByRole('menuitem', { name: '删除' }).click()
  await expect(rows).toHaveCount(before - 1)
})

test('500 messages are kept in a bounded DOM and older messages can be loaded', async ({ page }) => {
  await page.goto('/')
  await openFromMainMenu(page, '动效实验室')
  await page.getByRole('button', { name: /压力测试/ }).click()
  await expect(list(page).locator('.message-row')).toHaveCount(120)
  const load = page.getByRole('button', { name: /查看更早的/ })
  await expect(load).toBeVisible()
  await load.click()
  await expect(list(page).locator('.message-row')).toHaveCount(240)
})

test('reduced motion keeps sending functional', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.app-shell')).toHaveClass(/motion-off/)
  const input = page.getByRole('textbox', { name: '消息内容' })
  await input.fill('减少动效仍可发送')
  await input.press('Enter')
  await expect(list(page).getByText('减少动效仍可发送', { exact: true })).toBeVisible()
  await expect(page.locator('.flight-layer')).toHaveCount(0)
})

test('mobile: chat list first, chat pushes in and back returns', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 })
  await page.goto('/')
  await page.getByRole('button', { name: /Alex Chen/ }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/mobile-chat-open/)
  await expect(page.getByRole('button', { name: '返回会话列表' })).toBeVisible()
  await page.getByRole('button', { name: '返回会话列表' }).click()
  await expect(page.locator('.app-shell')).not.toHaveClass(/mobile-chat-open/)
})

test('AI export turns the live config into a faithful reproduction prompt', async ({ page }) => {
  await page.goto('/')
  await openFromMainMenu(page, '设置')
  await page.getByRole('button', { name: /AI 复刻导出/ }).click()
  const out = page.locator('.export-io')
  // textarea 的正文在 .value 里而非 textContent，统一经 value 断言
  const promptValue = () => out.evaluate((el: HTMLTextAreaElement) => el.value)
  const expectPrompt = async (substring: string) => {
    await expect.poll(async () => (await promptValue()).includes(substring), { timeout: 4000 })
      .toBe(true)
  }
  // 单效果：双曲线飞行的精确数值全部写进提示词
  await expectPrompt('# 动效复刻任务：消息发送飞行')
  await expectPrompt('cubic-bezier(0.23, 1, 0.32, 1)')
  await expectPrompt('cubic-bezier(0.1992, 0.0106, 0.2792, 0.9103)')
  await expectPrompt('"effect": "send"')
  // 目标框架切换 → 框架特定要求进入提示词
  await page.getByRole('radio', { name: /Vue 3/ }).click()
  await expectPrompt('Vue 特定要求')
  // 改全局时长 → 提示词自动跟随实时配置
  await backButton(page).click()
  await page.getByRole('button', { name: /动画与省电/ }).click()
  await page.locator('#duration').fill('500')
  await backButton(page).click()
  await page.getByRole('button', { name: /AI 复刻导出/ }).click()
  await expectPrompt('基础时长 500 ms')
  // 全套模式：12 个效果都在
  await page.getByText('导出全套动效系统', { exact: true }).click()
  await expect.poll(async () => (await promptValue()).match(/# 动效复刻任务/g)?.length ?? 0)
    .toBeGreaterThanOrEqual(12)
  await expectPrompt('动效系统总览')
})

test('AI export re-derives every number when power saving or mechanism switches change', async ({ page }) => {
  await page.goto('/')
  await openFromMainMenu(page, '设置')
  await page.getByRole('button', { name: /AI 复刻导出/ }).click()
  const out = page.locator('.export-io')
  const promptValue = () => out.evaluate((el: HTMLTextAreaElement) => el.value)
  const expectPrompt = async (substring: string) => {
    await expect.poll(async () => (await promptValue()).includes(substring), { timeout: 4000 }).toBe(true)
  }
  // 基线：完整等级下发送飞行用的是配置里的 320ms
  await expectPrompt('| 飞行时长 | `320 ms` |')
  // 开着省电 → 等级最多 1，heavy 类别被停用：数值必须归 0（旧实现会静默保留 320ms）
  await backButton(page).click()
  await page.getByRole('button', { name: /动画与省电/ }).click()
  await page.getByText('始终开启', { exact: true }).click()
  await backButton(page).click()
  await page.getByRole('button', { name: /AI 复刻导出/ }).click()
  await expectPrompt('| 飞行时长 | `0 ms` |')
  // 涟漪是 heavy 类别：等级 1 下时长归 0，提示词必须改口去讲 120ms 闪白分支
  await page.getByRole('radio', { name: '按下涟漪' }).click()
  await expectPrompt('| 波纹时长 | `0 ms` |')
  await expectPrompt('当前等级 ≤1（heavy 效果停用）')
  // 关掉省电 → 数值回到基准（涟漪 = 320ms × 1.5 = 480ms）
  await backButton(page).click()
  await page.getByRole('button', { name: /动画与省电/ }).click()
  await page.locator('label.radio-row').filter({ hasText: '关闭' }).click()
  await backButton(page).click()
  await page.getByRole('button', { name: /AI 复刻导出/ }).click()
  await expectPrompt('| 波纹时长 | `480 ms` |')
  // 机制开关同样要进提示词：关掉锚点补偿后不能再写成“由本实现接管”
  await backButton(page).click()
  await page.getByRole('button', { name: /动效实验室/ }).click()
  await page.getByText('锚点补偿', { exact: true }).click()
  await backButton(page).click()
  await page.getByRole('button', { name: /AI 复刻导出/ }).click()
  await page.getByRole('radio', { name: /滚动锚点/ }).click()
  await expectPrompt('关闭（交给浏览器原生 scroll anchoring）')
})

test('CI gate: a typical journey produces no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(String(e)))
  await page.goto('/')
  const input = page.getByRole('textbox', { name: '消息内容' })
  await input.fill('控制台健康检查')
  await input.press('Enter')
  await expect(page.locator('.flight-layer')).toHaveCount(0, { timeout: 5000 })
  await page.locator('.chat-entry').filter({ hasText: 'Alex Chen' }).first().click()
  await page.getByRole('button', { name: '打开动效设置' }).click()
  await expect(page.getByRole('region', { name: '设置面板' })).toBeVisible()
  expect(errors, 'the journey must be console-clean\n' + errors.join('\n')).toEqual([])
})
