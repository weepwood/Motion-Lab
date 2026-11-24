/**
 * motion-kit — easing & safe animation helpers
 * --------------------------------------------------------------------
 * Cubic-bezier evaluation (same math a browser tab uses), a damped-spring
 * solver emitted as CSS `linear()`, the classic tweb-measured curve presets,
 * and a `play()` wrapper that can never throw on an unknown easing string.
 */

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

/**
 * Curve presets measured from Telegram Web's source:
 * - standard  : `--transition-standard-easing` (almost every tweb transition)
 * - exit      : the "fly out fast, settle softly" curve (.23,1,.32,1)
 * - flightX/Y : send flight's separate horizontal / vertical curves
 */
export const CURVES = {
  standard: [0.4, 0, 0.2, 1],
  exit: [0.23, 1, 0.32, 1],
  flightX: [0.23, 1, 0.32, 1],
  flightY: [0.1992, 0.0106, 0.2792, 0.9103],
  overshoot: [0.34, 1.56, 0.64, 1]
}

/** @param {[number,number,number,number]} b */
export function bezierCss(b) {
  return `cubic-bezier(${b.map(n => Number(n.toFixed(4))).join(', ')})`
}

/**
 * Evaluate a CSS cubic-bezier at progress x (0..1) — binary search on the
 * parametric curve, the same approach browsers implement natively.
 * @param {[number,number,number,number]} b
 * @param {number} x
 */
export function bezierValue(b, x) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const [x1, y1, x2, y2] = b
  const axis = (t, p1, p2) => { const u = 1 - t; return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t }
  let lo = 0, hi = 1, t = x
  for (let i = 0; i < 40; i++) {
    const v = axis(t, x1, x2)
    if (Math.abs(v - x) < 1e-5) break
    if (v < x) lo = t; else hi = t
    t = (lo + hi) / 2
  }
  return axis(t, y1, y2)
}

/** Damped harmonic oscillator normalised to settle at t = 1. `bounce` 0 = critical, 0.6 = bouncy. */
export function springValue(t, bounce) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const zeta = clamp(1 - bounce, 0.3, 1)
  const omega = 12
  if (zeta > 0.999) return 1 - Math.exp(-omega * t) * (1 + omega * t)
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + (zeta * omega / wd) * Math.sin(wd * t))
}

let linearSupport
/** Does this browser support CSS `linear()` easing? */
export function supportsLinearEasing() {
  if (linearSupport === undefined) {
    try { linearSupport = typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 0.5, 1)') }
    catch { linearSupport = false }
  }
  return linearSupport
}

/** Sample the spring into a `linear()` timing function (falls back to an overshoot bezier). */
export function springCss(bounce) {
  if (!supportsLinearEasing()) return bezierCss(CURVES.overshoot)
  const points = []
  for (let i = 0; i <= 48; i++) points.push(Number(springValue(i / 48, bounce).toFixed(4)))
  return `linear(${points.join(', ')})`
}

/**
 * `element.animate()` throws on easing strings the engine does not know.
 * Always go through `play()` so an exotic curve can never break an interaction.
 * @returns {Animation | null}
 */
export function play(el, frames, duration, easing = 'ease', extra = {}) {
  if (duration <= 0 || typeof el?.animate !== 'function') return null
  try {
    return el.animate(frames, { ...extra, duration, easing })
  } catch {
    return el.animate(frames, { ...extra, duration, easing: 'ease-out' })
  }
}

/** Await an animation; cancellations resolve silently (they are expected). */
export async function settle(animation) {
  if (!animation) return
  try { await animation.finished } catch { /* cancelled on purpose */ }
}

/**
 * Drag an element's position with the pointer (one axis or two), returning
 * `cancel()`. Useful for small custom gestures on top of the kit.
 */
export function drag(el, { onStart, onUpdate, onEnd } = {}) {
  let active = null
  const down = e => {
    if (e.button !== undefined && e.button !== 0) return
    active = { id: e.pointerId, x: e.clientX, y: e.clientY }
    try { el.setPointerCapture(e.pointerId) } catch { /* not available */ }
    onStart?.(e)
  }
  const move = e => {
    if (!active || active.id !== e.pointerId) return
    const dx = e.clientX - active.x, dy = e.clientY - active.y
    onUpdate?.({ dx, dy }, e)
  }
  const up = e => {
    if (!active || active.id !== e.pointerId) return
    active = null
    onEnd?.(e)
  }
  el.addEventListener('pointerdown', down)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  return () => {
    el.removeEventListener('pointerdown', down)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
  }
}
