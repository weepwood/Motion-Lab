import type { Directive } from 'vue'
import { play } from './motion'
import { durationFor, easing } from './settings'

type RippleWave = {
  animations: Animation[]
  timers: number[]
  released: boolean
  cleanup: () => void
}
type RippleBinding = { handler: (e: PointerEvent) => void; layer: HTMLElement; waves: Set<RippleWave> }
const bindings = new WeakMap<HTMLElement, RippleBinding>()

/**
 * Telegram Web-style press ripple: it grows while the pointer is held, then
 * fades after release. Short presses keep the wave visible long enough to read.
 */
export const vRipple: Directive<HTMLElement> = {
  mounted(el) {
    el.dataset.rippable = ''
    const layer = document.createElement('span')
    layer.className = 'ripple-container'
    layer.setAttribute('aria-hidden', 'true')
    el.append(layer)

    const waves = new Set<RippleWave>()
    const handler = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return
      const duration = durationFor('ripple')
      if (!duration) return
      const rect = layer.getBoundingClientRect()
      const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left))
      const y = Math.min(rect.height, Math.max(0, e.clientY - rect.top))
      const farthestX = Math.max(x, rect.width - x)
      const farthestY = Math.max(y, rect.height - y)
      const radius = Math.hypot(farthestX, farthestY)
      const size = radius
      const wave = document.createElement('span')
      wave.className = 'ripple-wave'
      wave.style.width = wave.style.height = size + 'px'
      wave.style.left = x - size / 2 + 'px'
      wave.style.top = y - size / 2 + 'px'
      layer.append(wave)

      const startedAt = performance.now()
      const touch = e.pointerType === 'touch'
      const animation = play(wave, [
        { transform: `scale(${touch ? 0.27 : 0})` },
        { transform: 'scale(2)' }
      ], duration, easing.value, { fill: 'forwards' })
      const win = el.ownerDocument.defaultView || window
      let detachListeners = () => {}
      const rippleWave: RippleWave = {
        animations: animation ? [animation] : [],
        timers: [],
        released: false,
        cleanup: () => {
          detachListeners()
          rippleWave.timers.forEach(timer => win.clearTimeout(timer))
          rippleWave.animations.forEach(item => item.cancel())
          wave.remove()
          waves.delete(rippleWave)
        }
      }
      waves.add(rippleWave)

      const release = () => {
        if (rippleWave.released) return
        rippleWave.released = true
        detachListeners()

        const elapsed = performance.now() - startedAt
        const fadeDuration = duration / 2
        const fadeDelay = Math.max(duration - elapsed - fadeDuration, 0)
        const removeDelay = Math.max(duration - elapsed, fadeDuration)
        rippleWave.timers.push(win.setTimeout(() => {
          const fade = play(wave, [{ opacity: 1 }, { opacity: 0 }], fadeDuration, 'ease-out', { fill: 'forwards' })
          if (fade) rippleWave.animations.push(fade)
        }, fadeDelay))
        rippleWave.timers.push(win.setTimeout(rippleWave.cleanup, removeDelay))
      }
      const onPointerMove = (move: PointerEvent) => {
        if (touch && move.pointerId === e.pointerId && Math.hypot(move.clientX - e.clientX, move.clientY - e.clientY) > 8) release()
      }
      const onPointerEnd = (end: PointerEvent) => {
        if (end.pointerId === e.pointerId) release()
      }

      win.addEventListener('pointerup', onPointerEnd, { passive: true })
      win.addEventListener('pointercancel', onPointerEnd, { passive: true })
      win.addEventListener('blur', release, { once: true })
      if (touch) win.addEventListener('pointermove', onPointerMove, { passive: true })
      detachListeners = () => {
        win.removeEventListener('pointerup', onPointerEnd)
        win.removeEventListener('pointercancel', onPointerEnd)
        win.removeEventListener('blur', release)
        win.removeEventListener('pointermove', onPointerMove)
      }
    }
    bindings.set(el, { handler, layer, waves })
    el.addEventListener('pointerdown', handler)
  },
  unmounted(el) {
    const binding = bindings.get(el)
    if (!binding) return
    el.removeEventListener('pointerdown', binding.handler)
    binding.waves.forEach(wave => wave.cleanup())
    binding.layer.remove()
    delete el.dataset.rippable
    bindings.delete(el)
  }
}
