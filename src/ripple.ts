/**
 * v-ripple Vue directive — a thin wrapper over motion-kit's `attachRipple`.
 *
 * Geometry, damping and level-1 degradation live in the package; the app only
 * supplies the token bridge: `--mk-ripple-duration` / `--mk-ripple-easing`
 * are written by the settings store (see cssVars in App.vue) so the ripple
 * always follows the live motion settings, and `--mk-ripple-color` comes from
 * the theme / selected-entry CSS.
 */

import type { Directive } from 'vue'
import { attachRipple } from '../packages/motion/index.js'

const bindings = new WeakMap<HTMLElement, () => void>()

export const vRipple: Directive<HTMLElement> = {
  mounted(el) {
    el.dataset.rippable = ''
    bindings.set(el, attachRipple(el, {}))
  },
  unmounted(el) {
    bindings.get(el)?.()
    bindings.delete(el)
    delete el.dataset.rippable
  }
}
