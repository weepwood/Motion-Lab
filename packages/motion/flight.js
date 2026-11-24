/**
 * motion-kit — flights
 * --------------------------------------------------------------------
 * Two signature effects, both original implementations of mechanisms
 * measured in Telegram Web:
 *
 *  1. `flyClone`   — a snapshot of `source` flies to `target` along an arc
 *                    built from TWO separate curves (X fast-exit, Y slow-rise),
 *                    then cross-fades into the real element (landing).
 *  2. `flyParabola`— a small node flies along a real analytic parabola
 *                    y = y0 + b·t + a·t² with a landing reveal scheduled at a
 *                    fraction of the flight.
 *
 * Both only animate transform/opacity (compositor-friendly), both hold the
 * heavy-animation mutex while running, and both are interruptible: pass the
 * same `key` twice and the older flight cancels itself, cleaning up its clone.
 */

import { claimAnimation, holdHeavyAnimations } from './engine.js'
import { CURVES, clamp, play, settle, bezierCss } from './easing.js'

/** Element or DOMRect → its client rect. */
const rectOf = from =>
  from && typeof from.getBoundingClientRect === 'function' ? from.getBoundingClientRect() : from

/**
 * @typedef {Element | DOMRect | {left:number, top:number, width:number, height:number}} RectLike
 */

/**
 * @typedef {Object} FlyCloneOptions
 * @property {Element} source    element to snapshot (cloned node)
 * @property {Element} target    element whose rect is the flight destination
 * @property {RectLike} [from]   where the flight starts (default: source rect)
 * @property {Element} container where to append the clone (keep it inside the
 *                               same CSS variable scope so it inherits theming!)
 * @property {number}  [duration=300]
 * @property {[number,number,number,number]} [curveX=CURVES.flightX]
 * @property {[number,number,number,number]} [curveY=CURVES.flightY]
 * @property {number}  [landFade=100]   cross-fade at destination, ms
 * @property {unknown} [key]            interruption key (default: source)
 * @property {() => void} [reveal]      called at landing (show the real element)
 * @property {string} [className]       extra classes for the clone wrapper
 * @property {boolean} [hold=true]      hold the heavy-animation mutex while flying
 */

/**
 * Dual-curve flight of a cloned snapshot from `from` to `target`.
 * @param {FlyCloneOptions} opts
 * @returns {Promise<void>}
 */
export async function flyClone({
  source, from = source, target, container, duration = 300,
  curveX = CURVES.flightX, curveY = CURVES.flightY,
  landFade = 100, key = source, reveal = null, className = '', hold = true
}) {
  const startRect = rectOf(from)
  const to = rectOf(target)
  if (duration <= 0 || !startRect || !to || to.width <= 0 || to.height <= 0) { reveal?.(); return }
  const claim = claimAnimation(key)
  const wrapper = document.createElement('div')
  wrapper.className = ('mk-flight ' + className).trim()
  wrapper.setAttribute('aria-hidden', 'true')
  Object.assign(wrapper.style, {
    position: 'fixed', left: to.left + 'px', top: to.top + 'px',
    width: to.width + 'px', height: to.height + 'px',
    margin: '0', pointerEvents: 'none', willChange: 'transform', zIndex: '60'
  })
  const ghost = source.cloneNode(true)
  // The ghost keeps its look only if the wrapper inherits the same cascade.
  wrapper.append(ghost)
  container.append(wrapper)
  const active = []
  const track = animation => { if (animation) active.push(animation); return animation }
  const cleanup = () => { active.forEach(animation => animation.cancel()); wrapper.remove() }
  void claim.cancelled.then(cleanup)

  const dx = startRect.left - to.left
  const dy = startRect.top + startRect.height / 2 - (to.top + to.height / 2)
  const scale = clamp(startRect.height / Math.max(to.height, 1), 0.82, 1)
  const run = (async () => {
    const animations = [
      track(play(wrapper, [
        { transform: `translate3d(${dx}px,0,0)` },
        { transform: 'translate3d(0,0,0)' }
      ], duration, bezierCss(curveX), { fill: 'both' })),
      track(play(ghost, [
        { transform: `translate3d(0,${dy}px,0) scale(${scale})`, opacity: 0.4 },
        { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 }
      ], duration, bezierCss(curveY), { fill: 'both' }))
    ]
    await Promise.all(animations.map(settle))
    if (claim.isCancelled()) return
    reveal?.()
    if (landFade > 0) {
      await settle(track(play(ghost, [{ opacity: 1 }, { opacity: 0 }], landFade, 'ease-out', { fill: 'forwards' })))
    }
  })()
  if (hold) holdHeavyAnimations(run, duration + landFade + 1000)
  try { await run } finally { cleanup(); claim.done() }
}

/**
 * @typedef {Object} FlyParabolaOptions
 * @property {Element|string} source  element or text (emoji) shown while flying
 * @property {RectLike}  [from]    where the flight starts (required when `source` is a string)
 * @property {Element}   target   destination element
 * @property {Element}   container
 * @property {number}    [duration=300]
 * @property {number}    [elevation=30]  how high the arc rises mid-flight, px
 * @property {number}    [landing=0.75]  when `reveal()` fires, as a flight fraction
 * @property {number}    [scaleStart=1.6]
 * @property {unknown}    [key=target]
 * @property {() => void} [reveal]
 * @property {string}    [className]    extra classes for the flying node
 * @property {boolean}   [hold=true]
 */

/**
 * Parabola flight of a small node (emoji/button icon) from `from` to `target`.
 * @param {FlyParabolaOptions} opts
 * @returns {Promise<void>}
 */
export async function flyParabola({
  source, from = source, target, container, duration = 300,
  elevation = 30, landing = 0.75, scaleStart = 1.6, key = target,
  reveal = null, className = '', hold = true
}) {
  const startRect = rectOf(from)
  const to = rectOf(target)
  if (duration <= 0 || !startRect || !to || !Number.isFinite(startRect.left)) { reveal?.(); return }
  const claim = claimAnimation(key)
  const inline = typeof source === 'string' || source instanceof String
  const node = inline
    ? Object.assign(document.createElement('span'), { textContent: source })
    : source.cloneNode(true)
  node.className = ('mk-fly ' + className).trim()
  node.setAttribute('aria-hidden', 'true')
  Object.assign(node.style, {
    position: 'fixed', left: to.left + to.width / 2 + 'px', top: to.top + to.height / 2 + 'px',
    pointerEvents: 'none', willChange: 'transform', zIndex: '60'
  })
  container.append(node)
  let revealed = false
  const revealOnce = () => {
    if (!revealed && !claim.isCancelled()) { revealed = true; reveal?.() }
  }
  const revealTimer = setTimeout(revealOnce, Math.round(duration * clamp(landing, 0, 1)))

  const dx = startRect.left + startRect.width / 2 - (to.left + to.width / 2)
  const dy0 = startRect.top + startRect.height / 2 - (to.top + to.height / 2)
  // Quadratic through (0,dy0) and (1,0) whose midpoint rises by `elevation`.
  const yMid = dy0 / 2 - elevation
  const b = 4 * (yMid - dy0) - (0 - dy0)
  const a = (0 - dy0) - b
  const stops = 16
  const frames = []
  for (let i = 0; i <= stops; i++) {
    const t = i / stops
    const y = dy0 + b * t + a * t * t
    const scale = scaleStart + (1 - scaleStart) * t
    frames.push({ transform: `translate(-50%,-50%) translate3d(${(dx * (1 - t)).toFixed(2)}px,${y.toFixed(2)}px,0) scale(${scale.toFixed(3)})` })
  }
  const animation = play(node, frames, duration, 'linear', { fill: 'both' })
  const cleanup = () => { clearTimeout(revealTimer); animation?.cancel(); node.remove() }
  void claim.cancelled.then(cleanup)
  const run = settle(animation)
  if (hold) holdHeavyAnimations(run, duration + 1000)
  try { await run; revealOnce() } finally { cleanup(); claim.done() }
}

/**
 * Burst of particles around a point (tweb-style reaction particles).
 * @param {string} emoji
 * @param {DOMRect} at
 * @param {Element} container
 * @param {number} [duration=480]
 * @param {string} [className='mk-particle']  class for the particles (styling/sizing)
 */
export function burstParticles(emoji, at, container, duration = 480, className = 'mk-particle') {
  if (duration <= 0) return Promise.resolve()
  const count = 7
  let done = null
  let pending = count
  const bump = () => { if (--pending <= 0) done?.() }
  const run = new Promise(resolve => { done = resolve })
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span')
    p.className = className
    p.setAttribute('aria-hidden', 'true')
    p.textContent = emoji
    Object.assign(p.style, {
      position: 'fixed', left: at.left + at.width / 2 + 'px', top: at.top + at.height / 2 + 'px',
      pointerEvents: 'none', willChange: 'transform', zIndex: '60'
    })
    container.append(p)
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2
    const dist = 34 + (i % 3) * 10
    const anim = play(p, [
      { transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 },
      { transform: `translate(-50%,-50%) translate(${Math.cos(angle) * dist}px,${Math.sin(angle) * dist}px) scale(.9)`, opacity: 0 }
    ], duration, 'cubic-bezier(.2,.8,.2,1)', { fill: 'both' })
    void settle(anim).then(() => { p.remove(); bump() })
  }
  holdHeavyAnimations(run, duration + 1000)
  return run
}
