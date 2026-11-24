/**
 * Motion primitives for Motion Lab.
 *
 * Everything here is an original implementation. Curves, the spring solver and
 * the send "flight" only use transform / opacity so the compositor can run them.
 * The send flight follows the same idea as Telegram Web's `sendFlights.ts`:
 * a snapshot clone flies from the composer to the real bubble's final position,
 * with separate X/Y curves so the path arcs, then cross-fades into the real
 * bubble ("landing"). The reaction flight uses the analytic parabola from
 * tweb's `reactionFlight.ts`. Mechanism parameters come from the settings store.
 */

import { claimAnimation, cancelAnimationByKey } from './engine'
import type { MechanismParams } from './settings'

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

/** Telegram Web's standard UI curve — the token almost every tweb transition uses. */
export const TWEB_STANDARD: Bezier = [0.4, 0, 0.2, 1]

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

/* ------------------------------------------------------------------ flights */

interface FlightContext {
  claim: ReturnType<typeof claimAnimation>
  wrapper: HTMLElement
  animations: Set<Animation>
}

const FLIGHT_KEY = {}
let flightCtx: FlightContext | null = null

export function cancelFlight() {
  if (!flightCtx) return
  cancelAnimationByKey(FLIGHT_KEY)
}

function disposeFlight(ctx: FlightContext) {
  ctx.animations.forEach(a => a.cancel())
  ctx.animations.clear()
  ctx.wrapper.remove()
  ctx.claim.done()
}

/**
 * Send flight (FLIP + tweb sendFlights): clone the real bubble at its final
 * position, then play it backwards from the composer. X and Y use separate
 * curves (tweb CURVE_X/CURVE_Y) so the path arcs instead of moving straight.
 * When the clone lands, `reveal()` shows the real bubble and the clone
 * cross-fades out (tweb LAND_FADE). A new flight cancels the previous one.
 */
export async function flyBubble(
  target: HTMLElement,
  from: DOMRect,
  container: HTMLElement,
  duration: number,
  mech: Pick<MechanismParams, 'sendCurveX' | 'sendCurveY' | 'sendLandFade'>,
  reveal: (() => void) | null,
  rowClass = ''
): Promise<void> {
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
  const ctx: FlightContext = { claim: claimAnimation(FLIGHT_KEY), wrapper, animations: new Set() }
  flightCtx = ctx
  // Interruption (new send, chat switch, unmount) must always clean up.
  void ctx.claim.cancelled.then(() => { disposeFlight(ctx); if (flightCtx === ctx) flightCtx = null })

  const xAnim = play(wrapper, [
    { transform: `translate3d(${dx}px,0,0)` },
    { transform: 'translate3d(0,0,0)' }
  ], duration, bezierCss(mech.sendCurveX), { fill: 'both' })
  const yAnim = play(ghost, [
    { transform: `translate3d(0,${dy}px,0) scale(${scale})`, opacity: 0.4 },
    { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 }
  ], duration, bezierCss(mech.sendCurveY), { fill: 'both' })
  for (const a of [xAnim, yAnim]) if (a) ctx.animations.add(a)

  await Promise.all([xAnim, yAnim].map(settle))
  if (ctx.claim.isCancelled()) return
  // Landed: show the real bubble, then cross-fade the clone away (tweb LAND_FADE).
  reveal?.()
  const landFade = mech.sendLandFade
  if (landFade > 0) {
    const fade = play(ghost, [{ opacity: 1 }, { opacity: 0 }], landFade, 'ease-out', { fill: 'forwards' })
    if (fade) ctx.animations.add(fade)
    await settle(fade)
  }
  if (ctx.claim.isCancelled()) return
  disposeFlight(ctx)
  if (flightCtx === ctx) flightCtx = null
}

/**
 * Fly a small element (e.g. a reaction emoji) from one rect to another along a
 * real parabola (tweb reactionFlight): y = y0 + b·t + a·t² through the midpoint
 * raised by `elevation`; horizontal progress is linear. The landing target is
 * revealed at `landing`×duration (tweb LANDING_UNTIL = 0.75) so the chip
 * "receives" the emoji while it is still in the air.
 */
export async function flyEmoji(
  emoji: string,
  from: DOMRect,
  to: DOMRect,
  container: HTMLElement,
  duration: number,
  mech: Pick<MechanismParams, 'reactionElevation' | 'reactionLanding'>,
  options: { key?: unknown; scaleStart?: number; reveal?: () => void } = {}
): Promise<void> {
  if (duration <= 0) return
  const key = options.key ?? {}
  cancelAnimationByKey(key)
  const node = document.createElement('span')
  node.className = 'emoji-flight'
  node.textContent = emoji
  Object.assign(node.style, { left: to.left + to.width / 2 + 'px', top: to.top + to.height / 2 + 'px' })
  container.append(node)
  const claim = claimAnimation(key)
  let revealTimer: ReturnType<typeof setTimeout> | undefined
  void claim.cancelled.then(() => { if (revealTimer) clearTimeout(revealTimer); node.remove(); claim.done() })

  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy0 = from.top + from.height / 2 - (to.top + to.height / 2)
  // Parabola through (0, dy0), (1, 0) whose mid-flight point rises by `elevation`.
  const yMid = dy0 / 2 - mech.reactionElevation
  const b = 4 * (yMid - dy0) - (0 - dy0)
  const a = (0 - dy0) - b
  const stops = 16
  const frames: Keyframe[] = []
  for (let i = 0; i <= stops; i++) {
    const t = i / stops
    const y = dy0 + b * t + a * t * t
    const scale = (options.scaleStart ?? 1.6) + (1 - (options.scaleStart ?? 1.6)) * t
    frames.push({ transform: `translate(-50%,-50%) translate3d(${round(dx * t, 2)}px,${round(y, 2)}px,0) scale(${round(scale, 3)})`, offset: t || undefined })
  }
  // The landing target appears while the emoji is still in the air (tweb LANDING_UNTIL).
  revealTimer = setTimeout(() => { if (!claim.isCancelled()) options.reveal?.() }, Math.round(duration * mech.reactionLanding))
  const anim = play(node, frames, duration, 'linear', { fill: 'both' })
  if (claim.isCancelled()) { if (revealTimer) clearTimeout(revealTimer); return }
  if (anim) await settle(anim)
  if (revealTimer) clearTimeout(revealTimer)
  node.remove()
  claim.done()
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
