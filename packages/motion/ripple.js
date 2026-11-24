/**
 * motion-kit — ripple
 * --------------------------------------------------------------------
 * Telegram-style press ripple as a framework-free helper:
 *
 *   const detach = attachRipple(button)        // defaults, reads CSS tokens
 *   const detach = attachRipple(button, { duration: 700, easing: 'ease-out' })
 *
 * Geometry follows tweb: the circle's radius is the distance from the press
 * point to the FARTHEST corner, so one wave always covers the whole control.
 * Duration/easing default to CSS tokens so JS and CSS share one source of truth:
 *
 *   --mk-ripple-duration, --mk-ripple-easing, --mk-ripple-color
 *
 * At motion level 1 (`data-motion-level` on <html>) the expansion is replaced
 * by a quick opacity flash — reduced, not removed (tweb animation-level semantics).
 */

import { clamp, play } from './easing.js'

const FLASH = 120

/**
 * @typedef {Object} RippleOptions
 * @property {number} [duration]
 * @property {string} [easing]
 * @property {number} [startScale]  default 0 (touch pointers use ≥ 0.27 like tweb)
 * @property {number} [endScale]    default 2
 * @property {string} [color]        CSS background of the wave
 */

/**
 * Adds a press ripple to `el`.
 * @param {HTMLElement} el
 * @param {RippleOptions} [opts]
 * @returns {() => void} detach
 */
export function attachRipple(el, opts = {}) {
  // The clipping layer inherits the host radius, so the host stays untouched.
  const layer = document.createElement('span')
  layer.setAttribute('aria-hidden', 'true')
  Object.assign(layer.style, {
    position: 'absolute', inset: '0', overflow: 'hidden',
    borderRadius: 'inherit', pointerEvents: 'none'
  })
  const originalPosition = el.style.position
  const changedPosition = getComputedStyle(el).position === 'static'
  if (changedPosition) el.style.position = 'relative'
  el.append(layer)

  const cssVar = (name, fallback) => getComputedStyle(el).getPropertyValue(name).trim() || fallback
  const motionLevel = () => Number(document.documentElement.dataset.motionLevel ?? '2') || 0

  let live = null
  const waves = new Set()
  const dispose = t => {
    clearTimeout(t.timer)
    clearTimeout(t.removeTimer)
    t.anim?.cancel()
    t.fade?.cancel()
    t.wave.remove()
    waves.delete(t)
    if (live === t) live = null
  }

  const handler = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const token = cssVar('--mk-ripple-duration', '700ms')
    const parsed = Number.parseFloat(token) * (token.endsWith('s') && !token.endsWith('ms') ? 1000 : 1)
    const duration = opts.duration ?? (Number.isFinite(parsed) ? parsed : 700)
    if (!Number.isFinite(duration) || duration <= 0 || motionLevel() === 0) return
    if (live) dispose(live)
    const rect = el.getBoundingClientRect()
    const x = clamp(e.clientX - rect.left, 0, rect.width)
    const y = clamp(e.clientY - rect.top, 0, rect.height)
    // tweb formula: distance from the press point to the farthest corner.
    const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y))
    const wave = document.createElement('span')
    Object.assign(wave.style, {
      position: 'absolute', borderRadius: '50%',
      width: radius * 2 + 'px', height: radius * 2 + 'px',
      left: x - radius + 'px', top: y - radius + 'px',
      background: opts.color ?? cssVar('--mk-ripple-color', 'rgba(128,128,128,.14)'),
      transform: 'scale(0)', pointerEvents: 'none'
    })
    layer.append(wave)
    const start = opts.startScale ?? (e.pointerType === 'touch' ? 0.27 : 0)
    const end = opts.endScale ?? 2
    const reduced = motionLevel() < 2
    const anim = reduced
      ? play(wave, [{ transform: `scale(${end})`, opacity: 0 }, { transform: `scale(${end})`, opacity: 1 }], FLASH, 'ease-out', { fill: 'forwards' })
      : play(wave, [{ transform: `scale(${start})` }, { transform: `scale(${end})` }],
        duration, opts.easing ?? cssVar('--mk-ripple-easing', 'ease-out'), { fill: 'forwards' })
    live = { wave, anim, reduced, duration, start: performance.now(), x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch', id: e.pointerId }
    waves.add(live)
  }

  // tweb: a touch that turns into a scroll cancels the ripple immediately.
  const moveCancel = e => {
    if (!live?.touch || live.id !== e.pointerId) return
    if (Math.hypot(e.clientX - live.x, e.clientY - live.y) > 8) dispose(live)
  }

  const release = e => {
    const t = live
    if (!t || t.id !== e.pointerId) return
    if (e.type === 'pointercancel') { dispose(t); return }
    live = null
    const elapsed = performance.now() - t.start
    const fadeDuration = t.reduced ? FLASH / 2 : t.duration / 2
    const fadeDelay = t.reduced ? Math.max(FLASH - elapsed, 0) : Math.max(t.duration - elapsed - fadeDuration, 0)
    t.timer = setTimeout(() => {
      t.fade = play(t.wave, [{ opacity: getComputedStyle(t.wave).opacity }, { opacity: 0 }],
        fadeDuration, 'ease-out', { fill: 'forwards' })
      t.removeTimer = setTimeout(() => dispose(t), fadeDuration + 40)
      t.fade?.finished.then(() => dispose(t), () => {})
    }, fadeDelay)
  }

  el.addEventListener('pointerdown', handler)
  window.addEventListener('pointerup', release, { passive: true })
  window.addEventListener('pointercancel', release, { passive: true })
  window.addEventListener('pointermove', moveCancel, { passive: true })
  return () => {
    el.removeEventListener('pointerdown', handler)
    window.removeEventListener('pointerup', release)
    window.removeEventListener('pointercancel', release)
    window.removeEventListener('pointermove', moveCancel)
    waves.forEach(dispose)
    layer.remove()
    if (changedPosition && el.style.position === 'relative') el.style.position = originalPosition
  }
}
