import {computed,ref,watch} from 'vue'
import {defaults,isTimeline,type Effect} from './model'
import {parseProject,trackLength,type Track,type Project} from './project'
export type {Track} from './project'
const key='motion-lab-composition-v1'
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:min))
let seq=0
export function useComposition(){
 const tracks=ref<Track[]>([]),active=ref(''),error=ref('')
 const zoom=ref(1),snap=ref(20)
 try{const raw=localStorage.getItem(key);if(raw)tracks.value=parseProject(JSON.parse(raw)).tracks}catch{error.value='编排读取失败，原始数据保留'}
 active.value=tracks.value[0]?.id??''
 watch(tracks,()=>{try{localStorage.setItem(key,JSON.stringify(tracks.value))}catch{error.value='编排保存失败'}},{deep:true,flush:'sync'})
 const total=computed(()=>Math.max(1,...tracks.value.map(t=>t.delay+trackLength(t))))
 const current=computed(()=>tracks.value.find(t=>t.id===active.value))
 const newId=()=>globalThis.crypto?.randomUUID?.()??String(Date.now())+'-'+seq++
 function add(effect:Effect='slide'){if(tracks.value.length>=24||(!isTimeline(effect)&&effect!=='drag'))return;const id=newId();tracks.value.push({id,name:'轨道 '+(tracks.value.length+1),delay:0,muted:false,config:defaults(effect),group:'',gesture:[]});active.value=id}
 function remove(id:string){tracks.value=tracks.value.filter(t=>t.id!==id);if(active.value===id)active.value=tracks.value[0]?.id??''}
 function reorder(id:string,delta:number){const i=tracks.value.findIndex(t=>t.id===id),j=i+delta;if(i<0||j<0||j>=tracks.value.length)return;const next=[...tracks.value];[next[i],next[j]]=[next[j],next[i]];tracks.value=next}
 function delay(t:Track,value:number){const n=clamp(value,0,10000);t.delay=snap.value?Math.min(10000,Math.round(n/snap.value)*snap.value):n}
 function moveGroup(t:Track,delta:number){if(!t.group)return;const members=tracks.value.filter(x=>x.group===t.group);const bounded=Math.max(-Math.min(...members.map(x=>x.delay)),Math.min(10000-Math.max(...members.map(x=>x.delay)),delta));for(const x of members)x.delay+=bounded}
 function snapshot():Project{return parseProject({version:1,tracks:tracks.value})}
 function importProject(text:string){if(text.length>2_000_000)throw Error('项目文件过大');const next=parseProject(JSON.parse(text));if(tracks.value.length+next.tracks.length>24)throw Error('合并后超过 24 条轨道');tracks.value=[...tracks.value,...next.tracks.map(t=>({...t,id:newId()}))];active.value=tracks.value.at(-1)?.id??'';error.value=''}
 return {tracks,active,error,zoom,snap,total,current,add,remove,reorder,delay,moveGroup,snapshot,importProject}
}
