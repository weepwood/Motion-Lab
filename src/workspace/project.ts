import {sanitizeConfig,isTimeline,timelineLength,keyframes,easingOf,type Config} from './model'
import {gestureFrames,type GestureSample} from './gestureRecording'
export type Track={id:string;name:string;delay:number;muted:boolean;config:Config;group?:string;gesture?:GestureSample[]}
export type Project={version:1;tracks:Track[]}
const clamp=(x:unknown,lo:number,hi:number,fallback=0)=>typeof x==='number'&&Number.isFinite(x)?Math.max(lo,Math.min(hi,x)):fallback
export function parseProject(raw:unknown):Project{
 const input=Array.isArray(raw)?raw:raw&&typeof raw==='object'&&(raw as Project).version===1?(raw as Project).tracks:null
 if(!Array.isArray(input)||input.length>24)throw Error('不支持的编排格式或轨道超过 24 条')
 const ids=new Set<string>()
 const tracks=input.map((t:Track)=>{
  if(!t||typeof t.id!=='string'||!t.id||ids.has(t.id)||typeof t.name!=='string')throw Error('轨道 ID 无效或重复')
  ids.add(t.id);const config=sanitizeConfig(t.config)
  if(!isTimeline(config.effect)&&config.effect!=='drag')throw Error('不支持实时布局轨道')
  const gesture=Array.isArray(t.gesture)?t.gesture.slice(0,1500).filter(s=>s&&typeof s==='object').map(s=>({t:clamp(s.t,0,60000),x:clamp(s.x,-2000,2000),y:clamp(s.y,-2000,2000)})).sort((a,b)=>a.t-b.t):[]
  return {id:t.id,name:t.name.slice(0,80),delay:clamp(t.delay,0,10000),muted:!!t.muted,config,group:typeof t.group==='string'?t.group.slice(0,80):'',gesture}
 })
 return {version:1,tracks}
}
export function trackLength(t:Track){return t.config.effect==='drag'?t.config.duration:timelineLength(t.config)}
export function trackFrames(t:Track):Keyframe[]{
 if(t.config.effect!=='drag')return keyframes(t.config)
 const frames=gestureFrames(t.gesture??[])
 return frames.length>=2?frames:[{offset:0,transform:'none'},{offset:1,transform:'none'}]
}
export function projectHtml(project:Project){
 const data=JSON.stringify(project.tracks.filter(t=>!t.muted).map(t=>({name:t.name,delay:t.delay,duration:t.config.duration,stagger:t.config.effect==='stagger'?t.config.stagger:0,count:t.config.effect==='stagger'?4:1,frames:trackFrames(t),easing:t.config.effect==='drag'?'linear':easingOf(t.config)}))).replace(/</g,'\\u003c')
 return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Motion Lab 编排</title><style>body{font:14px system-ui;background:#f5f6f8;color:#242b38;padding:20px}main{display:flex;flex-wrap:wrap;gap:12px}section{border:1px solid #d8dde7;border-radius:10px;padding:16px;min-width:150px;min-height:130px;overflow:hidden}section div{display:inline-block;background:#7397df;border-radius:8px;width:40px;height:40px;margin:6px}</style><button id="play">播放编排</button><main id="stage"></main><script type="module">const tracks='+data+';const stage=document.getElementById("stage");let animations=[];const nodes=tracks.map(t=>{const section=document.createElement("section");const h=document.createElement("h3");h.textContent=t.name;section.append(h);const items=Array.from({length:t.count},()=>{const el=document.createElement("div");section.append(el);return el});stage.append(section);return items});function play(){animations.forEach(a=>a.cancel());animations=[];if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;tracks.forEach((t,i)=>nodes[i].forEach((el,j)=>animations.push(el.animate(t.frames,{duration:t.duration,delay:t.delay+j*t.stagger,easing:t.easing,fill:"both"}))))}document.getElementById("play").addEventListener("click",play);addEventListener("pagehide",()=>animations.forEach(a=>a.cancel()));play();</script></html>'
}
