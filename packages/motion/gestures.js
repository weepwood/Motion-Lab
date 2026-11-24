/**
 * motion-kit — damped horizontal swipe (tweb "swipe to reply" math)
 * --------------------------------------------------------------------
 *   constdetach = attachSwipe(card, {
 *     max: 64,            // finger-following cap before damping (px)
 *     trigger: 0.75,      // trigger threshold as a fraction of max
 *     onMove: ({ progress, distance }) => {},   // icon opacity etc.
 *     onEnd: ({ distance, triggered }) => {}    // reply / dismiss / snap back
 *   })
 *
 * Behaviour measured from Telegram Web's implementation:
 *  - lock-axis: |Δy| > 20px at any moment aborts the gesture (vertical scroll wins);
 *  - first |Δx| > |Δy| permanently locks the horizontal axis;
 *  - displacement follows the finger up to `max`, then damps the surplus to 25%;
 *  - the element returns with a spring-like transition when released.
 */

import { play } from './easing.js'

const AXIS_ABORT_Y = 20
const DAMPING = 0.25

/**
 * @typedef {Object} SwipeOptions
 * @property {number} [max=64]
 * @property {number} [trigger=0.75]
 * @property {string} [direction='left']     which way the drag goes
 * @property {(state: {progress: number, distance: number}) => void} [onMove]
 * @property {(state: {distance: number, triggered: boolean}) => void} [onEnd]
 * @property {string} [returnEasing]         snap-back curve (default CSS var --mk-ease)
 * @property {string} [returnDuration]       snap-back duration (default 250ms)
 */

/**
 * @param {HTMLElement} el
 * @param {SwipeOptions} [opts]
 * @returns {() => void} detach
 */
export function attachSwipe(el, opts = {}) {
  const max = opts.max ?? 64
  const triggerPx = Math.max(8, (opts.max ?? 64) * (opts.trigger ?? 0.75))
  const dir = opts.direction === 'right' ? 1 : -1
  let s = null
  const down = e => {
    if (e.button !== undefined && e.button !== 0) return
    if (e.target.closest?.('button, a, input, textarea')) return
    s = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, locked: false, dead: false }
  }
  const move = e => {
    if (!s || s.id !== e.pointerId || s.dead) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (!s.locked) {
      if (Math.abs(dy) > AXIS_ABORT_Y) { s.dead = true; clean(); return }
      if (Math.hypot(dx, dy) > 8 && Math.abs(dx) > Math.abs(dy)) {
        s.locked = true
        try { el.setPointerCapture(e.pointerId) } catch { /* ok */ }
        e.preventDefault?.()
      } else return
    }
    const pull = dir === -1 ? Math.max(0, -dx) : Math.max(0, dx)
    // damped follow: 1:1 up to max, then 25% of the surplus
    const offset = pull <= max ? pull : max + (pull - max) * DAMPING
    const distance = Math.min(offset, max + 48)
    s.dx = distance
    el.style.transform = `translate3d(${distance * dir}px,0,0)`
    opts.onMove?.({ progress: Math.min(1, distance / triggerPx), distance })
  }
  const up = e => {
    if (!s || s.id !== e.pointerId || s.dead) return
    const distance = s.dx
    const triggered = distance >= triggerPx && e.type !== 'pointercancel'
    s = null
    el.style.transform = ''
    const snapMs = Number.parseFloat(opts.returnDuration ?? '250') || 250
    const snapEase = opts.returnEasing
      ?? (getComputedStyle(el).getPropertyValue('--mk-ease').trim() || 'ease-out')
    play(el, [{ transform: `translate3d(${distance * dir}px,0,0)` }, { transform: 'translate3d(0,0,0)' }], snapMs, snapEase)
    opts.onEnd?.({ distance, triggered })
  }
  function clean() {
    if (s) { el.style.transform = ''; s = null }
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
