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

const fallbackEase = 'cubic-bezier(.4,0,.2,1)'

/**
 * @param {Object} opts
 * @param {number} [opts.x]              circle origin x (default: viewport center)
 * @param {number} [opts.y]
 * @param {number} [opts.duration=600]
 * @param {string} [opts.easing]
 * @param {() => void} opts.apply         the state change to reveal (sync DOM work)
 * @returns {Promise<void>}
 */
export async function revealFrom({ x, y, duration = 600, easing = fallbackEase, apply }) {
  const run = () => { apply?.() }
  const doc = document
  if (typeof doc.startViewTransition !== 'function' || duration <= 0) { run(); return }
  try {
    const transition = doc.startViewTransition(run)
    await transition.ready
    const cx = x ?? innerWidth / 2
    const cy = y ?? innerHeight / 2
    const radius = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy))
    const circle = r => `circle(${r}px at ${cx}px ${cy}px)`
    // Animate the snapshot pseudo-element; % radius math per tweb (engine-safe).
    doc.documentElement.animate(
      [{ clipPath: circle(0) }, { clipPath: circle(radius) }],
      { duration, easing, pseudoElement: '::view-transition-new(root)' }
    )
  } catch {
    run() // API present but transition failed: still apply the change.
  }
}
