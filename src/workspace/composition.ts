import { computed,ref,watch } from 'vue'
import { defaults,sanitizeConfig,isTimeline,timelineLength,type Config,type Effect } from './model'
export type Track={id:string;name:string;delay:number;muted:boolean;config:Config}
const key='motion-lab-composition-v1'
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:min))
let seq=0
export function useComposition(){
 const tracks=ref<Track[]>([]),active=ref(''),error=ref('')
 const zoom=ref(1),snap=ref(20)
 try{
  const raw=localStorage.getItem(key)
  if(raw){const data=JSON.parse(raw);if(!Array.isArray(data)||data.length>24)throw Error('invalid composition');tracks.value=data.map(t=>{const config=sanitizeConfig(t.config);if(!isTimeline(config.effect))throw Error('invalid track effect');return {id:String(t.id),name:String(t.name).slice(0,80),delay:clamp(Number(t.delay),0,10000),muted:!!t.muted,config}})}
 }catch{error.value='编排读取失败，原始数据保留'}
 active.value=tracks.value[0]?.id??''
 watch(tracks,()=>{try{localStorage.setItem(key,JSON.stringify(tracks.value))}catch{error.value='编排保存失败'}},{deep:true})
 const total=computed(()=>Math.max(1,...tracks.value.map(t=>t.delay+timelineLength(t.config))))
 const current=computed(()=>tracks.value.find(t=>t.id===active.value))
 function add(effect:Effect='slide'){if(tracks.value.length>=24||!isTimeline(effect))return;const id=crypto.randomUUID?.()??String(Date.now())+'-'+seq++;tracks.value.push({id,name:'轨道 '+(tracks.value.length+1),delay:0,muted:false,config:defaults(effect)});active.value=id}
 function remove(id:string){tracks.value=tracks.value.filter(t=>t.id!==id);if(active.value===id)active.value=tracks.value[0]?.id??''}
 function reorder(id:string,delta:number){const i=tracks.value.findIndex(t=>t.id===id),j=i+delta;if(i<0||j<0||j>=tracks.value.length)return;const next=[...tracks.value];[next[i],next[j]]=[next[j],next[i]];tracks.value=next}
 function delay(t:Track,value:number){const n=clamp(value,0,10000);t.delay=snap.value?Math.min(10000,Math.round(n/snap.value)*snap.value):n}
 return {tracks,active,error,zoom,snap,total,current,add,remove,reorder,delay}
}
