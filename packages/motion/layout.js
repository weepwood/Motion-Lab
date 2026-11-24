import { play, settle, springValue } from './easing.js'
const running = new WeakMap()
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const animate = (el, frames, duration, easing, extra = {}) => {
  running.get(el)?.cancel()
  if (reduced()) return null
  const animation = play(el, frames, duration, easing, extra)
  if (animation) {
    running.set(el, animation)
    void settle(animation).then(() => { if (running.get(el) === animation) running.delete(el) })
  }
  return animation
}
export function captureLayout(elements) {
  return new Map(Array.from(elements, el => [el, el.getBoundingClientRect()]))
}
export function animateLayout(before, { duration = 320, easing = 'cubic-bezier(.23,1,.32,1)' } = {}) {
  const entries = [...before].filter(([el]) => el.isConnected)
  // Capture visual positions before callers mutate; cancel old transforms before measuring the new layout.
  for (const [el] of entries) running.get(el)?.cancel()
  const after = entries.map(([el, rect]) => [el, rect, el.getBoundingClientRect()])
  return after.flatMap(([el, first, last]) => {
    if (!last.width || !last.height) return []
    const x = first.left - last.left, y = first.top - last.top, sx = first.width / last.width, sy = first.height / last.height
    if (Math.abs(x) + Math.abs(y) + Math.abs(sx - 1) + Math.abs(sy - 1) < .01) return []
    const anim = animate(el, [{ transformOrigin: '0 0', transform: 'translate('+x+'px,'+y+'px) scale('+sx+','+sy+')' }, { transformOrigin: '0 0', transform: 'none' }], duration, easing)
    return anim ? [anim] : []
  })
}
export function sharedElement(source, target, options) {
  return animateLayout(new Map([[target, source.getBoundingClientRect()]]), options)
}
export function springFrames(from, to, bounce = .3, samples = 48) {
  const count = Math.max(2, Math.min(120, Math.round(samples)))
  return Array.from({ length: count + 1 }, (_, i) => ({ offset: i / count, value: from + (to - from) * springValue(i / count, bounce) }))
}
export function staggerIn(elements, { duration = 300, stagger = 45, distance = 18, easing = 'ease-out' } = {}) {
  return Array.from(elements).flatMap((el, i) => {
    const anim = animate(el, [{ transform: 'translateY('+distance+'px)', opacity: 0 }, { transform: 'none', opacity: 1 }], duration, easing, { delay: i * stagger, fill: 'backwards' })
    return anim ? [anim] : []
  })
}
export function cancelLayout(elements) {
  for (const el of elements) running.get(el)?.cancel()
}
