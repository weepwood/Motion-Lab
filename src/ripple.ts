import type { Directive } from 'vue'
import { play, settle } from './motion'
import { durationFor } from './settings'

type RippleBinding = { handler: (e: PointerEvent) => void; layer: HTMLElement }
const bindings = new WeakMap<HTMLElement, RippleBinding>()

/**
 * Material-style ripple like Telegram Web: a circle grows from the pointer
 * position and fades out. Disabled automatically by the `ripple` animation
 * switch, reduced motion and power-saving mode.
 */
export const vRipple: Directive<HTMLElement> = {
  mounted(el) {
    el.dataset.rippable = ''
    const layer = document.createElement('span')
    layer.className = 'ripple-container'
    layer.setAttribute('aria-hidden', 'true')
    el.append(layer)

    const handler = (e: PointerEvent) => {
      if (e.button !== 0) return
      const duration = durationFor('ripple')
      if (!duration) return
      const rect = layer.getBoundingClientRect()
      const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left))
      const y = Math.min(rect.height, Math.max(0, e.clientY - rect.top))
      const farthestCorner = Math.max(
        Math.hypot(x, y),
        Math.hypot(rect.width - x, y),
        Math.hypot(x, rect.height - y),
        Math.hypot(rect.width - x, rect.height - y)
      )
      const size = farthestCorner * 2
      const wave = document.createElement('span')
      wave.className = 'ripple-wave'
      wave.style.width = wave.style.height = size + 'px'
      wave.style.left = x - size / 2 + 'px'
      wave.style.top = y - size / 2 + 'px'
      layer.append(wave)
      const anim = play(wave, [
        { transform: 'scale(0)', opacity: 1 },
        { transform: 'scale(1)', opacity: 1, offset: 0.55 },
        { transform: 'scale(1)', opacity: 0 }
      ], duration, 'cubic-bezier(.2,.6,.3,1)', { fill: 'both' })
      void settle(anim).then(() => wave.remove())
    }
    bindings.set(el, { handler, layer })
    el.addEventListener('pointerdown', handler)
  },
  unmounted(el) {
    const binding = bindings.get(el)
    if (!binding) return
    el.removeEventListener('pointerdown', binding.handler)
    binding.layer.remove()
    delete el.dataset.rippable
    bindings.delete(el)
  }
}
