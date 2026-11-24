import {captureLayout,animateLayout,cancelLayout} from './layout.js'
import {play} from './easing.js'
/** Measured built-in layout scenes and static/recorded tracks on one clock. */
export function mountComposition(root,tracks){
 const stage=document.createElement('div')
 stage.dataset.compositionStage=''
 Object.assign(stage.style,{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(180px,100%),1fr))',gap:'10px',width:'100%'})
 root.append(stage)
 let disposed=false,raf=0,resizeRaf=0,animations=[],last=0,time=0,observer,lastWidth=0
 const nodes=[]
 const entries=tracks.map(t=>{
  const lane=document.createElement('section');lane.dataset.compositionTrack=t.id
  Object.assign(lane.style,{border:'1px solid rgba(127,140,160,.28)',borderRadius:'10px',padding:'12px',minWidth:'0',overflow:'hidden'})
  const label=document.createElement('div');label.textContent=t.name;label.style.cssText='font-size:12px;opacity:.8;margin-bottom:12px';lane.append(label)
  const area=document.createElement('div');area.style.cssText='display:flex;align-items:center;gap:8px;min-height:100px;flex-wrap:wrap;justify-content:center';lane.append(area);stage.append(lane)
  const items=Array.from({length:t.effect==='flip'?4:t.count},(_,i)=>{
   const el=document.createElement('div');el.dataset.compositionItem=String(i+1);el.textContent=String(i+1);el.style.cssText='width:36px;height:36px;background:#729cea;color:#152340;border-radius:8px;display:grid;place-items:center;font-size:12px;flex:none;transform-origin:0 0'
   area.append(el);nodes.push(el);return el
  })
  return {t,area,items}
 })
 const total=Math.max(1,...tracks.map(t=>t.delay+t.duration+(t.count-1)*t.stagger))
 const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches
 function prepare(){
  animations.forEach(x=>x.a.cancel());animations=[];cancelLayout(nodes)
  // Reset the scene, measure actual first rectangles, mutate DOM, then measure final rectangles.
  for(const {t,area,items} of entries){
   if(t.effect==='flip')items.forEach(el=>area.append(el))
   if(t.effect==='shared'){items[0].style.width='36px';items[0].style.height='36px';area.style.justifyContent='flex-start'}
  }
  const measured=entries.map(entry=>({entry,before:['flip','shared'].includes(entry.t.effect)?captureLayout(entry.items):null}))
  // Batch DOM mutations before subsequent geometry reads across the scene.
  for(const {t,area,items} of entries){
   if(t.effect==='flip')area.append(items[0])
   if(t.effect==='shared'){items[0].style.width='76px';items[0].style.height='64px';area.style.justifyContent='flex-end'}
  }
  for(const {entry:{t,items},before} of measured){
   if(reduced()||t.duration<=0)continue
   if(before){
    for(const a of animateLayout(before,{duration:t.duration,easing:t.easing,physics:t.physics})){a.effect?.updateTiming({fill:'both'});a.pause();animations.push({a,delay:t.delay,duration:t.duration})}
   }else for(const [i,el] of items.entries()){
    const a=play(el,t.frames,t.duration,t.easing,{fill:'both'});if(a){a.pause();animations.push({a,delay:t.delay+i*t.stagger,duration:t.duration})}
   }
  }
  seek(time)
 }
 function seek(ms){time=Math.max(0,Math.min(total,Number.isFinite(ms)?ms:0));for(const {a,delay,duration} of animations)a.currentTime=Math.max(0,Math.min(duration,time-delay))}
 function pause(){cancelAnimationFrame(raf);raf=0}
 function start(){pause();seek(0);if(reduced()){seek(total);return}last=performance.now();const tick=now=>{if(disposed)return;seek(time+now-last);last=now;if(time<total)raf=requestAnimationFrame(tick);else raf=0};raf=requestAnimationFrame(tick)}
 function dispose(){if(disposed)return;disposed=true;pause();cancelAnimationFrame(resizeRaf);observer?.disconnect();animations.forEach(x=>x.a.cancel());animations=[];cancelLayout(nodes);stage.remove()}
 prepare()
 if(typeof ResizeObserver!=='undefined'){lastWidth=root.clientWidth;observer=new ResizeObserver(()=>{if(disposed||root.clientWidth===lastWidth)return;lastWidth=root.clientWidth;cancelAnimationFrame(resizeRaf);resizeRaf=requestAnimationFrame(()=>{if(!disposed)prepare()})});observer.observe(root)}
 return {seek,play:start,pause,dispose,total,refresh:prepare}
}
