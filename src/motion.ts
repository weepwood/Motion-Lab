/**
 * UI-layer motion adapter.
 *
 * Since v3.2 the actual engine, curve maths and effect implementations live in
 * the dependency-free `packages/motion` toolkit (motion-kit). This file keeps
 * only what belongs to the app layer:
 *
 *  - the easing presets shown in the settings UI (labels/descriptions);
 *  - thin wrappers that pipe the app's settings/mechanism parameters into the
 *    toolkit's APIs, keeping the signatures App.vue already uses;
 *  - re-exports of the toolkit primitives so the rest of the app keeps one
 *    import path.
 */

import {
  CURVES,
  bezierCss as pkgBezierCss,
  bezierValue as pkgBezierValue,
  clamp as pkgClamp,
  springValue as pkgSpringValue,
  springCss as pkgSpringCss,
  supportsLinearEasing as pkgSupportsLinear,
  play as pkgPlay,
  settle as pkgSettle,
  flyClone,
  flyParabola,
  burstParticles,
  claimAnimation,
  cancelAnimationByKey,
  holdHeavyAnimations,
  revealFrom as pkgRevealFrom
} from '../packages/motion/index.js'
import type { MechanismParams } from './settings'

export type Bezier = [number, number, number, number]
export type EasingKey = 'telegram' | 'soft' | 'snappy' | 'spring' | 'custom'

/* ---------------------------------------------- UI easing presets (layer 2) */

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
export const TWEB_STANDARD: Bezier = CURVES.standard

/** Used when the browser does not understand CSS `linear()` easing. */
export const SPRING_FALLBACK: Bezier = CURVES.overshoot
const DEFAULT_BEZIER: Bezier = [0.23, 1, 0.32, 1]

/* --------------------------------------- primitive re-exports (motion-kit) */

export const clamp = pkgClamp
export const bezierCss = pkgBezierCss
export const bezierValue = pkgBezierValue
export const springValue = pkgSpringValue
export const springCss = pkgSpringCss
export const supportsLinearEasing = pkgSupportsLinear
export const play = pkgPlay
export const settle = pkgSettle
export { claimAnimation, holdHeavyAnimations }

/* ------------------------------------------------------- preset resolution */

export function bezierFor(key: EasingKey, custom: Bezier): Bezier {
  if (key === 'custom') return custom
  if (key === 'spring') return SPRING_FALLBACK
  return easingMeta[key].bezier ?? DEFAULT_BEZIER
}

export function easingValue(key: EasingKey, custom: Bezier, bounce: number, x: number): number {
  if (key === 'spring') return springValue(x, bounce)
  return bezierValue(bezierFor(key, custom), x)
}

export function easingCss(key: EasingKey, custom: Bezier, bounce: number): string {
  return key === 'spring' ? springCss(bounce) : bezierCss(bezierFor(key, custom))
}

/* -------------------------------------------------- app-level flight API */

/** A single send flight at a time, like tweb's sendFlights. */
const FLIGHT_KEY = { send: true }

export function cancelFlight() {
  cancelAnimationByKey(FLIGHT_KEY)
}

/**
 * Send flight: clone the real bubble, fly it from the composer with separate
 * X/Y curves (mechanism params, tier 3), cross-fade into the real bubble on
 * landing. Interruption-safe via the toolkit's keyed instances.
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
  await flyClone({
    source: target,
    from,
    target,
    container,
    duration,
    curveX: mech.sendCurveX,
    curveY: mech.sendCurveY,
    landFade: mech.sendLandFade,
    key: FLIGHT_KEY,
    reveal: reveal ?? undefined,
    className: ('flight-layer ' + rowClass).trim()
  })
}

/**
 * Reaction flight: the emoji flies along an analytic parabola whose landing
 * reveal fires early (mechanism params, tier 3).
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
  // The flight lands on the reaction icon inside the chip; a plain rect target.
  await flyParabola({
    source: emoji,
    from,
    target: { left: to.left, top: to.top, width: to.width, height: to.height },
    container,
    duration,
    elevation: mech.reactionElevation,
    landing: mech.reactionLanding,
    key: options.key,
    scaleStart: options.scaleStart ?? 1.6,
    reveal: options.reveal,
    className: 'emoji-flight'
  })
}

/** Reaction particle burst (power-saving / heavy effects gate upstream). */
export function burst(emoji: string, at: DOMRect, container: HTMLElement, duration: number) {
  return burstParticles(emoji, at, container, duration, 'particle')
}

/** Theme/state circular reveal (View Transitions), used by App.setTheme. */
export const revealFrom = pkgRevealFrom
