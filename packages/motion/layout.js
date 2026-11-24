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

/** Analytic damped oscillator, velocity in units/s, duration in ms. Last sample snaps to target for finite previews. */
export function physicalSpringFrames(from,to,{mass=1,stiffness=180,damping=18,velocity=0,duration=500,samples=60}={}){
  const m=Math.max(.01,mass),k=Math.max(.01,stiffness),c=Math.max(0,damping)
  const w=Math.sqrt(k/m),a=c/(2*m),x=from-to,v=velocity
  const count=Math.max(2,Math.min(240,Math.round(samples)))
  function position(t){
    if(Math.abs(a-w)<1e-6)return Math.exp(-a*t)*(x+(v+a*x)*t)
    if(a<w){const b=Math.sqrt(w*w-a*a);return Math.exp(-a*t)*(x*Math.cos(b*t)+(v+a*x)/b*Math.sin(b*t))}
    const b=Math.sqrt(a*a-w*w),r1=-a+b,r2=-a-b,A=(v-r2*x)/(r1-r2)
    return A*Math.exp(r1*t)+(x-A)*Math.exp(r2*t)
  }
  return Array.from({length:count+1},(_,i)=>({offset:i/count,value:i===count?to:to+position(Math.max(0,duration)/1000*i/count)}))
}
