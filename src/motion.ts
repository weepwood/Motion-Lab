/**
 * Motion primitives for Motion Lab.
 *
 * Everything here is an original implementation. Curves, the spring solver and
 * the send "flight" only use transform / opacity so the compositor can run them.
 */

export type Bezier = [number, number, number, number]
export type EasingKey = 'telegram' | 'soft' | 'snappy' | 'spring' | 'custom'

export interface EasingMeta {
  label: string
  description: string
  bezier?: Bezier
}

export const easingMeta: Record<EasingKey, EasingMeta> = {
  telegram: { label: 'Telegram', description: '起步迅速、尾段柔和减速，适合大多数界面过渡', bezier: [0.23, 1, 0.32, 1] },
  soft: { label: '柔和', description: '前后对称的平滑过渡，适合大面积转场', bezier: [0.25, 0.1, 0.25, 1] },
  snappy: { label: '灵敏', description: '指数型减速，几乎立即响应手势', bezier: [0.16, 1, 0.3, 1] },
  spring: { label: '弹簧', description: '阻尼弹簧物理模拟，可调节回弹幅度' },
  custom: { label: '自定义', description: '拖动曲线上的两个控制点来调整贝塞尔曲线' }
}

export const easingOrder: EasingKey[] = ['telegram', 'soft', 'snappy', 'spring', 'custom']

/** Used when the browser does not understand CSS `linear()` easing. */
export const SPRING_FALLBACK: Bezier = [0.34, 1.56, 0.64, 1]
const DEFAULT_BEZIER: Bezier = [0.23, 1, 0.32, 1]

const round = (n: number, digits = 3) => Number(n.toFixed(digits))
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export function bezierCss(b: Bezier): string {
  return `cubic-bezier(${b.map(n => round(n)).join(', ')})`
}

export function bezierFor(key: EasingKey, custom: Bezier): Bezier {
  if (key === 'custom') return custom
  if (key === 'spring') return SPRING_FALLBACK
  return easingMeta[key].bezier ?? DEFAULT_BEZIER
}

/**
 * Damped harmonic oscillator, normalised so the motion settles at t = 1.
 * `bounce` 0 = critically damped, 0.6 = very bouncy.
 */
export function springValue(t: number, bounce: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const zeta = clamp(1 - bounce, 0.3, 1)
  const omega = 12
  if (zeta > 0.999) return 1 - Math.exp(-omega * t) * (1 + omega * t)
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + (zeta * omega / wd) * Math.sin(wd * t))
}

/** Evaluate a CSS cubic-bezier at progress x (0..1). */
export function bezierValue(b: Bezier, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const [x1, y1, x2, y2] = b
  const curve = (t: number, p1: number, p2: number) => {
    const u = 1 - t
    return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t
  }
  let lo = 0
  let hi = 1
  let t = x
  for (let i = 0; i < 40; i++) {
    const v = curve(t, x1, x2)
    if (Math.abs(v - x) < 1e-5) break
    if (v < x) lo = t
    else hi = t
    t = (lo + hi) / 2
  }
  return curve(t, y1, y2)
}

export function easingValue(key: EasingKey, custom: Bezier, bounce: number, x: number): number {
  if (key === 'spring') return springValue(x, bounce)
  return bezierValue(bezierFor(key, custom), x)
}

let linearSupport: boolean | undefined
export function supportsLinearEasing(): boolean {
  if (linearSupport === undefined) {
    try {
      linearSupport = typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 0.5, 1)')
    } catch {
      linearSupport = false
    }
  }
  return linearSupport
}

export function springCss(bounce: number): string {
  if (!supportsLinearEasing()) return bezierCss(SPRING_FALLBACK)
  const steps = 48
  const points: number[] = []
  for (let i = 0; i <= steps; i++) points.push(round(springValue(i / steps, bounce), 4))
  return `linear(${points.join(', ')})`
}

export function easingCss(key: EasingKey, custom: Bezier, bounce: number): string {
  return key === 'spring' ? springCss(bounce) : bezierCss(bezierFor(key, custom))
}

/**
 * element.animate() throws for easing strings the engine does not know.
 * Always go through this helper so an exotic curve can never break an interaction.
 */
export function play(el: Element, frames: Keyframe[], duration: number, easing: string, extra: KeyframeAnimationOptions = {}): Animation | null {
  if (duration <= 0 || typeof el.animate !== 'function') return null
  try {
    return el.animate(frames, { ...extra, duration, easing })
  } catch {
    return el.animate(frames, { ...extra, duration, easing: 'ease-out' })
  }
}

export async function settle(animation: Animation | null | undefined): Promise<void> {
  if (!animation) return
  try {
    await animation.finished
  } catch {
    // Cancelled on purpose (new send, chat switch, unmount).
  }
}

let flight: { wrapper: HTMLElement; animations: Animation[] } | null = null

export function cancelFlight() {
  if (!flight) return
  flight.animations.forEach(a => a.cancel())
  flight.wrapper.remove()
  flight = null
}

/**
 * Send flight (FLIP): clone the real bubble at its final position, then play it
 * backwards from the composer. X and Y run on slightly different durations so the
 * path arcs instead of moving in a straight line.
 * The clone is appended inside `container` so it inherits the active theme variables,
 * and wrapped in an element carrying the row classes so it keeps the same look.
 */
export async function flyBubble(target: HTMLElement, from: DOMRect, container: HTMLElement, duration: number, easing: string, rowClass = ''): Promise<void> {
  cancelFlight()
  const to = target.getBoundingClientRect()
  if (duration <= 0 || to.width <= 0 || to.height <= 0) return
  const wrapper = document.createElement('div')
  // The wrapper mimics the message row so row-scoped bubble styles (colour, radius, tail) still apply.
  wrapper.className = ('flight-layer ' + rowClass).trim()
  Object.assign(wrapper.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' })
  const ghost = target.cloneNode(true) as HTMLElement
  ghost.classList.add('flight-ghost')
  ghost.removeAttribute('data-mid')
  ghost.setAttribute('aria-hidden', 'true')
  wrapper.append(ghost)
  container.append(wrapper)

  const dx = from.left + 14 - to.left
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  const scale = clamp(from.height / Math.max(to.height, 1), 0.82, 1)
  const xAnim = play(wrapper, [
    { transform: `translate3d(${dx}px,0,0)` },
    { transform: 'translate3d(0,0,0)' }
  ], duration, easing, { fill: 'both' })
  const yAnim = play(ghost, [
    { transform: `translate3d(0,${dy}px,0) scale(${scale})`, opacity: 0.4 },
    { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 }
  ], Math.round(duration * 0.82), easing, { fill: 'both' })
  const animations = [xAnim, yAnim].filter((a): a is Animation => a !== null)
  const current = { wrapper, animations }
  flight = current
  await Promise.all(animations.map(settle))
  if (flight === current) flight = null
  wrapper.remove()
}

/** Fly a small element (e.g. a reaction emoji) from one rect to another. */
export async function flyEmoji(emoji: string, from: DOMRect, to: DOMRect, container: HTMLElement, duration: number, easing: string): Promise<void> {
  if (duration <= 0) return
  const node = document.createElement('span')
  node.className = 'emoji-flight'
  node.textContent = emoji
  Object.assign(node.style, { left: to.left + to.width / 2 + 'px', top: to.top + to.height / 2 + 'px' })
  container.append(node)
  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  const anim = play(node, [
    { transform: `translate(-50%,-50%) translate3d(${dx}px,${dy}px,0) scale(1.6)` },
    { transform: `translate(-50%,-50%) translate3d(${dx * 0.35}px,${dy * 0.35 - 36}px,0) scale(1.9)`, offset: 0.45 },
    { transform: 'translate(-50%,-50%) translate3d(0,0,0) scale(1)' }
  ], duration, easing, { fill: 'both' })
  await settle(anim)
  node.remove()
}

/** Burst of particles around a point; skipped entirely in power-saving mode. */
export function burst(emoji: string, at: DOMRect, container: HTMLElement, duration: number) {
  if (duration <= 0) return
  const count = 7
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span')
    p.className = 'particle'
    p.textContent = emoji
    Object.assign(p.style, { left: at.left + at.width / 2 + 'px', top: at.top + at.height / 2 + 'px' })
    container.append(p)
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2
    const dist = 34 + (i % 3) * 10
    const anim = play(p, [
      { transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 },
      { transform: `translate(-50%,-50%) translate(${Math.cos(angle) * dist}px,${Math.sin(angle) * dist}px) scale(.9)`, opacity: 0 }
    ], duration, 'cubic-bezier(.2,.8,.2,1)', { fill: 'both' })
    void settle(anim).then(() => p.remove())
  }
}

/* ------------------------------------------------------------------
 * Legacy API, kept only so the current App.vue keeps compiling while the
 * new modules land. Removed together with the App.vue rewrite.
 * ------------------------------------------------------------------ */

/** @deprecated use EasingKey */
export type MotionPreset = 'telegram' | 'soft' | 'snappy' | 'spring'

/** @deprecated use easingMeta + easingCss */
export const motionPresets: Record<MotionPreset, { label: string; ease: string; description: string }> = {
  telegram: { label: 'Telegram', ease: bezierCss([0.23, 1, 0.32, 1]), description: '快速响应，柔和减速' },
  soft: { label: '柔和', ease: bezierCss([0.25, 0.1, 0.25, 1]), description: '舒适的自然过渡' },
  snappy: { label: '灵敏', ease: bezierCss([0.16, 1, 0.3, 1]), description: '更高的响应速度' },
  spring: { label: '回弹', ease: bezierCss(SPRING_FALLBACK), description: '轻微弹性过冲' }
}

/** @deprecated read `system.reducedMotion` from settings.ts */
export function systemReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** @deprecated use flyBubble */
export async function flyText(
  text: string, from: DOMRect, to: DOMRect, duration: number, ease: string,
  outgoingColor?: string, outgoingText?: string
): Promise<void> {
  cancelFlight()
  if (duration <= 0 || to.width <= 0 || to.height <= 0) return
  const ghost = document.createElement('div')
  ghost.className = 'flight-ghost'
  ghost.textContent = text
  Object.assign(ghost.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', maxWidth: to.width + 'px', minHeight: to.height + 'px' })
  if (outgoingColor) ghost.style.background = outgoingColor
  if (outgoingText) ghost.style.color = outgoingText
  document.body.append(ghost)
  const dx = from.left + Math.min(from.width * 0.25, 60) - to.left
  const dy = from.top + from.height / 2 - to.top - to.height / 2
  const scale = clamp(from.width / Math.max(to.width, 1), 0.83, 1)
  const anim = play(ghost, [
    { transform: `translate3d(${dx}px,${dy}px,0) scale(${scale})`, opacity: 0.35, offset: 0 },
    { transform: `translate3d(${dx * 0.38}px,${dy * 0.25}px,0) scale(.98)`, opacity: 0.95, offset: 0.68 },
    { transform: 'translate3d(0,0,0) scale(1)', opacity: 1, offset: 1 }
  ], duration, ease, { fill: 'forwards' })
  const current = { wrapper: ghost, animations: anim ? [anim] : [] }
  flight = current
  await settle(anim)
  if (flight === current) flight = null
  ghost.remove()
}
