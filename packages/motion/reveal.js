/**
 * motion-kit — view-transition reveal (tweb themeController)
 * --------------------------------------------------------------------
 * Circular reveal of an arbitrary state change, applied under the browser's
 * View Transitions snapshot so every colour on the page participates:
 *
 *   revealFrom({
 *     x: e.clientX, y: e.clientY,        // circle origin (default: center)
 *     duration: 600,                      // ms (tweb: 600 night, 500 day)
 *     easing: 'cubic-bezier(.4,0,.2,1)',
 *     apply: () => root.classList.toggle('dark')   // the actual change
 *   })
 *
 * Colors are NOT interpolated — the change lands instantly and the snapshot
 * clip reveals it (exactly what tweb does). Graceful no-op when the API is
 * missing: `apply()` runs directly.
 */

import { holdHeavyAnimations } from './engine.js'
import { play, settle } from './easing.js'

const fallbackEase = 'cubic-bezier(.4,0,.2,1)'

/**
 * @param {Object} opts
 * @param {number} [opts.x]              circle origin x (default: viewport center)
 * @param {number} [opts.y]
 * @param {number} [opts.duration=600]
 * @param {string} [opts.easing]
 * @param {() => void | Promise<void>} opts.apply         the state change to reveal (sync DOM work)
 * @returns {Promise<void>}
 */
export async function revealFrom({ x, y, duration = 600, easing = fallbackEase, apply }) {
  let applied
  const run = () => applied ??= Promise.resolve().then(() => apply?.())
  const doc = document
  if (typeof doc.startViewTransition !== 'function' || duration <= 0) { await run(); return }
  try {
    const transition = doc.startViewTransition(run)
    // Observe completion even when ready rejects (e.g. rapid consecutive reveals).
    holdHeavyAnimations(transition.finished ?? transition.ready, duration + 1000)
    await transition.ready
    const cx = x ?? innerWidth / 2
    const cy = y ?? innerHeight / 2
    const radius = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy))
    const circle = r => `circle(${r}px at ${cx}px ${cy}px)`
    // Animate the snapshot pseudo-element; % radius math per tweb (engine-safe).
    await settle(play(doc.documentElement,
      [{ clipPath: circle(0) }, { clipPath: circle(radius) }],
      duration, easing, { pseudoElement: '::view-transition-new(root)' }
    ))
    await transition.finished
  } catch {
    await run() // apply at most once, even if ready/finished rejected after the update.
  }
}
