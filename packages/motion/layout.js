import { play, settle, springValue, drag } from './easing.js'
const running = new WeakMap()
const physicalRuns = new WeakMap()
const captureVelocities = new WeakMap()
function velocityAt(el){
 const run=physicalRuns.get(el)
 if(!run||running.get(el)!==run.animation||run.animation.playState==='finished'||run.animation.playState==='idle')return undefined
 const t=Number(run.animation.currentTime)||0, step=run.duration/(run.xs.length-1)
 if(step<=0)return undefined
 const i=Math.min(run.xs.length-2,Math.max(0,Math.floor(t/step)))
 const rate=frames=>(frames[i+1].value-frames[i].value)*1000/step
 return [rate(run.xs),rate(run.ys),rate(run.scalesX)*run.width,rate(run.scalesY)*run.height]
}
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const animate = (el, frames, duration, easing, extra = {}) => {
  running.get(el)?.cancel()
  if (reduced()) return null
  const animation = play(el, frames, duration, easing, extra)
  if (animation) {
    running.set(el, animation)
    void settle(animation).then(() => { if (running.get(el) === animation) running.delete(el); if(physicalRuns.get(el)?.animation===animation)physicalRuns.delete(el) })
  }
  return animation
}
export function captureLayout(elements) {
  const list=Array.from(elements)
  const rects=new Map(list.map(el=>[el,el.getBoundingClientRect()]))
  // Only physical animations need a velocity snapshot. Ordinary FLIP avoids per-element allocations.
  let velocities
  for(const el of list){if(!physicalRuns.has(el))continue;const v=velocityAt(el);if(v){velocities??=new Map();velocities.set(el,v)}}
  if(velocities)captureVelocities.set(rects,velocities)
  return rects
}
export function animateLayout(before, { duration = 320, easing = 'cubic-bezier(.23,1,.32,1)', physics } = {}) {
  const entries = [...before].filter(([el]) => el.isConnected)
  // Capture visual positions before callers mutate; cancel old transforms before measuring the new layout.
  for (const [el] of entries) running.get(el)?.cancel()
  const after = entries.map(([el, rect]) => [el, rect, el.getBoundingClientRect()])
  return after.flatMap(([el, first, last]) => {
    if (!last.width || !last.height) return []
    const x = first.left - last.left, y = first.top - last.top, sx = first.width / last.width, sy = first.height / last.height
    if (Math.abs(x) + Math.abs(y) + Math.abs(sx - 1) + Math.abs(sy - 1) < .01) return []
    if(physics&&duration>0){
      const prior=captureVelocities.get(before)?.get(el)
      const opts={...physics,duration},xs=physicalSpringFrames(x,0,{...opts,velocity:prior?.[0]??physics.velocity??0}),ys=physicalSpringFrames(y,0,{...opts,velocity:prior?.[1]??0})
      const scalesX=physicalSpringFrames(sx,1,{...opts,velocity:(prior?.[2]??0)/last.width}),scalesY=physicalSpringFrames(sy,1,{...opts,velocity:(prior?.[3]??0)/last.height})
      const frames=xs.map((v,i)=>({offset:v.offset,transformOrigin:'0 0',transform:'translate('+v.value+'px,'+ys[i].value+'px) scale('+Math.max(.01,scalesX[i].value)+','+Math.max(.01,scalesY[i].value)+')'}))
      const anim=animate(el,frames,duration,'linear')
      if(anim)physicalRuns.set(el,{animation:anim,xs,ys,scalesX,scalesY,width:last.width,height:last.height,duration})
      return anim?[anim]:[]
    }
    physicalRuns.delete(el)
    const anim = animate(el, [{ transformOrigin: '0 0', transform: 'translate('+x+'px,'+y+'px) scale('+sx+','+sy+')' }, { transformOrigin: '0 0', transform: 'none' }], duration, easing)
    return anim ? [anim] : []
  })
}
export function sharedElement(source, target, options) {
  const rects=new Map([[target,source.getBoundingClientRect()]])
  const velocity=velocityAt(source);if(velocity)captureVelocities.set(rects,new Map([[target,velocity]]))
  return animateLayout(rects, options)
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
  for (const el of elements) {running.get(el)?.cancel();physicalRuns.delete(el)}
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
  return Array.from({length:count+1},(_,i)=>{
    const offset=i/count,tail=Math.max(0,(offset-.85)/.15),blend=1-tail*tail*(3-2*tail)
    return {offset,value:i===count?to:to+position(Math.max(0,duration)/1000*offset)*blend}
  })
}

/** Interruptible spring drag, shared by previews and generated applications. */
export function attachSpringDrag(el,{duration=320,physics={},onRecord=()=>{},onInterrupt=()=>{}}={}){
  let returning=null, x=0,y=0,originX=0,originY=0,start=0,samples=[]
  const original=el.style.transform
  const detach=drag(el,{
    onStart(){
      const value=getComputedStyle(el).transform
      const matrix=value==='none'?new DOMMatrixReadOnly():new DOMMatrixReadOnly(value)
      originX=x=matrix.m41;originY=y=matrix.m42
      returning?.cancel();onInterrupt()
      el.style.transform='translate('+x+'px,'+y+'px)'
      start=performance.now();samples=[{t:0,x,y}]
    },
    onUpdate(p){
      x=originX+p.dx;y=originY+p.dy
      if(samples.length<1500)samples.push({t:performance.now()-start,x,y})
      el.style.transform='translate('+x+'px,'+y+'px)'
    },
    onEnd(){
      const end=performance.now()-start,last=samples.at(-1)
      const prior=[...samples].reverse().find(s=>last&&last.t-s.t>=20)
      const dt=last&&prior?(last.t-prior.t)/1000:0
      const velocity=v=>Math.max(-2000,Math.min(2000,v))
      const recent=last&&prior&&dt>0&&dt<=.1&&end-last.t<=80
      const vx=recent?velocity((last.x-prior.x)/dt):0,vy=recent?velocity((last.y-prior.y)/dt):0
      if(samples.length<1500)samples.push({t:end,x,y})
      onRecord(samples.map(s=>({...s})))
      el.style.transform=original
      if(reduced()||duration<=0)return
      const xs=physicalSpringFrames(x,0,{...physics,duration,velocity:vx}),ys=physicalSpringFrames(y,0,{...physics,duration,velocity:vy})
      returning=play(el,xs.map((s,i)=>({offset:s.offset,transform:'translate('+s.value+'px,'+ys[i].value+'px)'})),duration,'linear')
    }
  })
  return ()=>{detach();returning?.cancel();el.style.transform=original}
}
