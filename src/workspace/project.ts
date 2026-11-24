import {sanitizeConfig,timelineLength,keyframes,easingOf,type Config} from './model'
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
  const gesture=Array.isArray(t.gesture)?t.gesture.slice(0,1500).filter(s=>s&&typeof s==='object').map(s=>({t:clamp(s.t,0,60000),x:clamp(s.x,-2000,2000),y:clamp(s.y,-2000,2000)})).sort((a,b)=>a.t-b.t):[]
  return {id:t.id,name:t.name.slice(0,80),delay:clamp(t.delay,0,10000),muted:!!t.muted,config,group:typeof t.group==='string'?t.group.slice(0,80):'',gesture}
 })
 return {version:1,tracks}
}
export function trackLength(t:Track){return t.config.effect==='drag'?t.config.duration:timelineLength(t.config)}
export function trackFrames(t:Track):Keyframe[]{
 if(t.config.effect!=='drag')return keyframes(t.config)
 const samples=t.gesture??[],start=samples[0]?.t??0
 const frames=gestureFrames(samples.map(s=>({...s,t:s.t-start})))
 return frames.length>=2?frames:[{offset:0,transform:'none'},{offset:1,transform:'none'}]
}
export function projectTracks(project:Project){
 return project.tracks.filter(t=>!t.muted).map(t=>({id:t.id,name:t.name,effect:t.config.effect,delay:t.delay,duration:t.config.duration,stagger:t.config.effect==='stagger'?t.config.stagger:0,count:t.config.effect==='stagger'?4:1,frames:trackFrames(t),easing:t.config.effect==='drag'?'linear':easingOf(t.config),physics:t.config.physics}))
}
