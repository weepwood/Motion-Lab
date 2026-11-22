import type { Directive } from 'vue'
import { play, settle } from './motion'
import { durationFor } from './settings'

const handlers = new WeakMap<HTMLElement, (e: PointerEvent) => void>()

/**
 * Material-style ripple like Telegram Web: a circle grows from the pointer
 * position and fades out. Disabled automatically by the `ripple` animation
 * switch, reduced motion and power-saving mode.
 */
export const vRipple: Directive<HTMLElement> = {
  mounted(el) {
    el.classList.add('rippable')
    const handler = (e: PointerEvent) => {
      if (e.button !== 0) return
      const duration = durationFor('ripple')
      if (!duration) return
      const rect = el.getBoundingClientRect()
      const size = Math.hypot(rect.width, rect.height) * 2
      const wave = document.createElement('span')
      wave.className = 'ripple-wave'
      wave.style.width = wave.style.height = size + 'px'
      wave.style.left = e.clientX - rect.left - size / 2 + 'px'
      wave.style.top = e.clientY - rect.top - size / 2 + 'px'
      el.append(wave)
      const anim = play(wave, [
        { transform: 'scale(0)', opacity: 1 },
        { transform: 'scale(1)', opacity: 1, offset: 0.55 },
        { transform: 'scale(1)', opacity: 0 }
      ], duration, 'cubic-bezier(.2,.6,.3,1)', { fill: 'both' })
      void settle(anim).then(() => wave.remove())
    }
    handlers.set(el, handler)
    el.addEventListener('pointerdown', handler)
  },
  unmounted(el) {
    const handler = handlers.get(el)
    if (handler) el.removeEventListener('pointerdown', handler)
    handlers.delete(el)
  }
}
