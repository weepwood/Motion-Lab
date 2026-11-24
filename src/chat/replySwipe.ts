import type { Directive } from 'vue'
import { attachSwipe } from '../../packages/motion/index.js'
import { settings, durationFor, easingFor } from '../settings'

export function createReplySwipe<M>(options: { onReply: (m: M) => void; onLongPress: (m: M, x: number, y: number) => void; vibrate: () => void }): Directive<HTMLElement, M> {
  const bindings = new WeakMap<HTMLElement, { message: M; detach: () => void }>()
  return {
    mounted(el, binding) {
      const row = el.closest<HTMLElement>('.message-row')
      let armed = false
      const reset = () => { armed = false; row?.classList.remove('swiping'); row?.style.removeProperty('--swipe') }
      const state = { message: binding.value, detach: () => {} }
      state.detach = attachSwipe(el, {
        get max() { return settings.mech.swipeMax },
        get trigger() { return settings.mech.swipeTrigger },
        get returnDuration() { return String(durationFor('sidebar')) },
        get returnEasing() { return easingFor('sidebar') },
        ignore: 'button, a, input, textarea, .bubble-reply',
        onLock: () => { row?.classList.add('swiping'); window.getSelection()?.removeAllRanges() },
        onMove: ({ progress }) => {
          row?.style.setProperty('--swipe', progress.toFixed(3))
          if (progress >= 1 && !armed) options.vibrate()
          armed = progress >= 1
        },
        onReset: reset,
        onEnd: ({ triggered }) => { if (triggered) options.onReply(state.message) },
        onLongPress: () => { const rect = el.getBoundingClientRect(); options.onLongPress(state.message, rect.left + rect.width / 2, rect.top + 16) }
      })
      bindings.set(el, state)
    },
    updated(el, binding) { const state = bindings.get(el); if (state) state.message = binding.value },
    beforeUnmount(el) { bindings.get(el)?.detach(); bindings.delete(el) }
  }
}
