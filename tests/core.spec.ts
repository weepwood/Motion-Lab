import { expect, test } from '@playwright/test'

const moduleUrl = '/packages/motion/index.js'
test('parabola starts at source and lands at target; cancellation settles promptly', async ({ page }) => {
  await page.goto('/demo/')
  const result = await page.evaluate(async url => {
    const kit = await import(url)
    const key = {}
    const container = document.body
    let revealed = 0
    const run = kit.flyParabola({ source: 'x', from: { left: 10, top: 20, width: 20, height: 20 },
      target: { left: 110, top: 70, width: 20, height: 20 }, container, duration: 10000,
      key, reveal: () => revealed++ })
    const node = container.querySelector('.mk-fly')!
    const animation = node.getAnimations()[0]
    const frames = (animation.effect as KeyframeEffect).getKeyframes()
    kit.cancelAnimationByKey(key)
    const settled = await Promise.race([run.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 500))])
    return { first: frames[0].transform, last: frames[frames.length - 1].transform, settled, revealed, remaining: container.querySelectorAll('.mk-fly').length }
  }, moduleUrl)
  expect(result.first).toMatch(/translate3d\(-100(?:\.00)?px,\s*-50(?:\.00)?px,\s*0(?:px)?\)/)
  expect(result.last).toMatch(/translate3d\(0(?:\.00)?px,\s*0(?:\.00)?px,\s*0(?:px)?\)/)
  expect(result.settled).toBe(true)
  expect(result.revealed).toBe(0)
  expect(result.remaining).toBe(0)
})

test('ripple respects zero duration and level zero, then cleans repeated presses', async ({ page }) => {
  await page.goto('/demo/')
  const result = await page.evaluate(async url => {
    const { attachRipple } = await import(url)
    const el = document.createElement('button')
    document.body.append(el)
    el.style.setProperty('--mk-ripple-duration', '0ms')
    const detach = attachRipple(el)
    const press = (id: number) => el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, button: 0, pointerType: 'mouse' }))
    const count = () => el.querySelectorAll('span span').length
    press(1)
    const zero = count()
    el.style.setProperty('--mk-ripple-duration', '0.1s')
    document.documentElement.dataset.motionLevel = '0'
    press(1)
    const off = count()
    document.documentElement.dataset.motionLevel = '2'
    press(1); press(2)
    const repeated = count()
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
    const unrelated = count()
    detach()
    return { zero, off, repeated, unrelated, detached: el.childElementCount }
  }, moduleUrl)
  expect(result).toEqual({ zero: 0, off: 0, repeated: 1, unrelated: 1, detached: 0 })
})

test('reveal applies exactly once even if ready rejects after update', async ({ page }) => {
  await page.goto('/demo/')
  const count = await page.evaluate(async url => {
    const { revealFrom } = await import(url)
    const original = document.startViewTransition
    let count = 0
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: (apply: () => Promise<void>) => {
      const update = apply()
      const ready = update.then(() => { throw new Error('skipped') })
      return { ready, finished: update }
    } })
    try { await revealFrom({ duration: 200, apply: () => { count++ } }); return count }
    finally { Object.defineProperty(document, 'startViewTransition', { configurable: true, value: original }) }
  }, moduleUrl)
  expect(count).toBe(1)
})

test('swipe detach restores inline transform and leaves no active gesture', async ({ page }) => {
  await page.goto('/demo/')
  const result = await page.evaluate(async url => {
    const { attachSwipe } = await import(url)
    const el = document.createElement('div')
    document.body.append(el)
    el.style.transform = 'scale(1)'
    let ended = 0
    const detach = attachSwipe(el, { onEnd: () => ended++ })
    const pointer = (type: string, x: number) => el.dispatchEvent(new PointerEvent(type, { pointerId: 1, button: 0, clientX: x, clientY: 20, isPrimary: true }))
    pointer('pointerdown', 100)
    pointer('pointermove', 20)
    const moving = el.style.transform
    detach()
    pointer('pointerup', 20)
    return { moving, restored: el.style.transform, ended }
  }, moduleUrl)
  expect(result.moving).toContain('translate3d')
  expect(result.restored).toBe('scale(1)')
  expect(result.ended).toBe(0)
})

test('scroll saver accepts arbitrary row keys without CSS selector injection', async ({ page }) => {
  await page.goto('/demo/')
  const result = await page.evaluate(async url => {
    const { createScrollSaver } = await import(url)
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;top:0;left:0;height:100px;width:100px;overflow:auto;overflow-anchor:none'
    const row = document.createElement('div')
    row.className = 'row'
    row.setAttribute('data-key', 'a"b]c')
    row.style.height = '200px'
    el.append(row); document.body.append(el)
    const saver = createScrollSaver(el, '.row', 'data-key')
    saver.save()
    const pad = document.createElement('div')
    pad.style.height = '60px'
    el.prepend(pad)
    saver.restore()
    return el.scrollTop
  }, moduleUrl)
  expect(result).toBe(60)
})

test('storage preserves zero overrides and falls back to inherited easing', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('motion-lab-settings-v3', JSON.stringify({ overrides: { send: { duration: 0, easing: 'invalid' } } })))
  await page.reload()
  await expect.poll(() => page.locator('.app-shell').evaluate(el => getComputedStyle(el).getPropertyValue('--dur-send').trim())).toBe('0ms')
})
