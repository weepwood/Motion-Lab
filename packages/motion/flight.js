/**
 * motion-kit — flights
 * --------------------------------------------------------------------
 * Two signature effects, both original implementations of mechanisms
 * measured in Telegram Web:
 *
 *  1. `flyClone`   — a snapshot of `source` flies to `target` along an arc
 *                    built from TWO separate curves (X fast-exit, Y slow-rise),
 *                    then cross-fades into the real element (landing).
 *  2. `flyParabola`— an emoji-sized node flies along a real analytic parabola
 *                    y = y0 + b·t + a·t² with a landing reveal scheduled at a
 *                    fraction of the flight.
 *
 * Both only animate transform/opacity (compositor-friendly) and both are
 * interruptible: pass the same `key` twice and the older flight cancels
 * itself, cleaning up its clone.
 */

import { claimAnimation } from './engine.js'
import { CURVES, clamp, play, settle, bezierCss } from './easing.js'

const rects = el => (el.getBoundingClientRect ? el.getBoundingClientRect() : el)

/**
 * @typedef {Object} FlyCloneOptions
 * @property {Element} source    element to snapshot (cloned node)
 * @property {Element} target    element whose rect is the flight destination
 * @property {Element} container  where to append the clone (keep it inside the
 *                               same CSS variable scope so it inherits theming!)
 * @property {number}  [duration=300]
 * @property {[number,number,number,number]} [curveX=CURVES.flightX]
 * @property {[number,number,number,number]} [curveY=CURVES.flightY]
 * @property {number}  [landFade=100]   cross-fade at destination, ms
 * @property {unknown} [key]            interruption key (default: source)
 * @property {() => void} [reveal]      called at landing (show the real element)
 * @property {string} [className]      extra classes for the clone wrapper
 */

/**
 * Dual-curve flight of a cloned snapshot from `source` to `target`.
 * @param {FlyCloneOptions} opts
 * @returns {Promise<void>}
 */
export async function flyClone({
  source, target, container, duration = 300,
  curveX = CURVES.flightX, curveY = CURVES.flightY,
  landFade = 100, key = source, reveal = null, className = ''
}) {
  const from = rects(source)
  const to = rects(target)
  if (duration <= 0 || to.width <= 0 || to.height <= 0) return
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
  void claim.cancelled.then(() => { wrapper.remove(); claim.done() })

  const dx = from.left - to.left
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  const scale = clamp(from.height / Math.max(to.height, 1), 0.82, 1)
  const animations = [
    play(wrapper, [
      { transform: `translate3d(${dx}px,0,0)` },
      { transform: 'translate3d(0,0,0)' }
    ], duration, bezierCss(curveX), { fill: 'both' }),
    play(ghost, [
      { transform: `translate3d(0,${dy}px,0) scale(${scale})`, opacity: 0.4 },
      { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 }
    ], duration, bezierCss(curveY), { fill: 'both' })
  ]
  await Promise.all(animations.map(settle))
  if (claim.isCancelled()) return
  reveal?.()
  if (landFade > 0) {
    await settle(play(ghost, [{ opacity: 1 }, { opacity: 0 }], landFade, 'ease-out', { fill: 'forwards' }))
  }
  if (claim.isCancelled()) return
  wrapper.remove()
  claim.done()
}

/**
 * @typedef {Object} FlyParabolaOptions
 * @property {Element|string} source  element or text (emoji) shown while flying
 * @property {Element} target  destination element
 * @property {Element} container
 * @property {number}  [duration=300]
 * @property {number}  [elevation=30]  how high the arc rises mid-flight, px
 * @property {number}  [landing=0.75] when `reveal()` fires, as a flight fraction
 * @property {number}  [scaleStart=1.6]
 * @property {unknown} [key=target]
 * @property {() => void} [reveal]
 */

/**
 * Parabola flight of a small node (emoji/button icon) from `source` to `target`.
 * @param {FlyParabolaOptions} opts
 * @returns {Promise<void>}
 */
export async function flyParabola({
  source, target, container, duration = 300,
  elevation = 30, landing = 0.75, scaleStart = 1.6, key = target, reveal = null
}) {
  if (duration <= 0) return
  const from = rects(source)
  const to = rects(target)
  const claim = claimAnimation(key)
  const node = typeof source === 'string' || source instanceof String
    ? Object.assign(document.createElement('span'), { textContent: source })
    : source.cloneNode(true)
  node.setAttribute('aria-hidden', 'true')
  Object.assign(node.style, {
    position: 'fixed', left: to.left + to.width / 2 + 'px', top: to.top + to.height / 2 + 'px',
    pointerEvents: 'none', willChange: 'transform', zIndex: '60',
    transform: 'translate(-50%,-50%)'
  })
  container.append(node)
  const revealTimer = setTimeout(() => { if (!claim.isCancelled()) reveal?.() }, Math.round(duration * landing))
  void claim.cancelled.then(() => { clearTimeout(revealTimer); node.remove(); claim.done() })

  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy0 = from.top + from.height / 2 - (to.top + to.height / 2)
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
    frames.push({ transform: `translate(-50%,-50%) translate3d(${(dx * t).toFixed(2)}px,${y.toFixed(2)}px,0) scale(${scale.toFixed(3)})` })
  }
  await settle(play(node, frames, duration, 'linear', { fill: 'both' }))
  clearTimeout(revealTimer)
  node.remove()
  claim.done()
}
