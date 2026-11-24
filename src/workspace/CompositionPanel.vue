<script setup lang="ts">
import {computed,watch,ref} from 'vue'
import {useComposition,type Track} from './composition'
import {usePlayback} from './usePlayback'
import {catalog,isTimeline,defaults,timelineLength,type Effect} from './model'
import Preview from './Preview.vue'
import GestureTrack from './GestureTrack.vue'
import {trackLength} from './project'
import {projectHtml,projectCode,projectZip} from './projectExport'
import CompositionStage from './CompositionStage.vue'
import ParameterPanel from './ParameterPanel.vue'
const {tracks,active,error,zoom,snap,total,current,add,remove,reorder,delay,moveGroup,snapshot,importProject}=useComposition()
const {time,playing,loop,seek,pause,play}=usePlayback(()=>{},()=>total.value)
const effects=catalog
const combined=ref(false)
const selectedFrame=ref<number|null>(null),notice=ref('')
watch(active,()=>{selectedFrame.value=null},{flush:'sync'})
function addFrame(){const c=current.value?.config;if(!c||c.frames.length>=30||c.effect==='spring'||!isTimeline(c.effect))return;const offset=Math.round(c.middle*100)/100;if(c.frames.some(f=>f.offset===offset))return;c.frames.push({offset,x:0,y:-20,scale:1,opacity:1});c.frames.sort((a,b)=>a.offset-b.offset);selectFrame(offset)}
function removeFrame(i:number){current.value?.config.frames.splice(i,1);selectedFrame.value=null}
function selectFrame(offset:number){if(!current.value)return;selectedFrame.value=offset;pause();seek(current.value.delay+offset*current.value.config.duration)}
function moveFrame(from:number,to:number){const c=current.value?.config;if(!c||!Number.isFinite(to))return;const offset=Math.round(Math.max(.01,Math.min(.99,to))*100)/100;const frame=c.frames.find(f=>f.offset===from);if(!frame||c.frames.some(f=>f!==frame&&f.offset===offset))return;frame.offset=offset;c.frames.sort((a,b)=>a.offset-b.offset);selectFrame(offset)}
function download(text:string|Blob,name:string){const url=URL.createObjectURL(typeof text==='string'?new Blob([text],{type:name.endsWith('.html')?'text/html':'text/plain'}):text);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function loadProject(e:Event){const input=e.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{if(file.size>2_000_000)throw Error('项目文件过大');importProject(await file.text());notice.value='已合并项目，原轨道保留'}catch(err){notice.value=String(err)}finally{input.value=''}}
const width=computed(()=>Math.max(100,zoom.value*100)+'%')
const percent=(ms:number)=>Math.max(0,Math.min(100,ms/total.value*100))
const dragging=ref<{id:string;pointer:number;startX:number;startDelay:number;span:number;width:number;draft:number}|null>(null)
function beginDrag(e:PointerEvent,t:Track){if(e.button!==0)return;pause();active.value=t.id;const el=e.currentTarget as HTMLElement;const width=el.parentElement!.getBoundingClientRect().width;if(!width)return;dragging.value={id:t.id,pointer:e.pointerId,startX:e.clientX,startDelay:t.delay,span:total.value,width,draft:t.delay};try{el.setPointerCapture(e.pointerId)}catch{}}
function moveTrack(e:PointerEvent){const d=dragging.value;if(!d||d.pointer!==e.pointerId)return;const raw=Math.max(0,Math.min(10000,d.startDelay+(e.clientX-d.startX)/d.width*d.span));d.draft=snap.value?Math.min(10000,Math.round(raw/snap.value)*snap.value):Math.round(raw)}
function finishTrack(e:PointerEvent,commit:boolean){const d=dragging.value;if(!d||d.pointer!==e.pointerId)return;dragging.value=null;const t=tracks.value.find(t=>t.id===d.id);if(commit&&t)delay(t,d.draft)}
const shownDelay=(t:Track)=>dragging.value?.id===t.id?dragging.value.draft:t.delay
function changeEffect(t:Track,value:Effect){const duration=t.config.duration;t.config=defaults(value);t.config.duration=duration;t.gesture=[];selectedFrame.value=null}
function editDuration(t:Track,e:Event){const n=Number((e.target as HTMLInputElement).value);if(Number.isFinite(n))t.config.duration=Math.max(0,Math.min(3000,n))}
function scrub(e:Event){pause();seek(Number((e.target as HTMLInputElement).value))}
watch(total,()=>{seek(time.value)})
</script>
<template>
<section class="ws-composition">
 <div class="ws-heading"><div><small>COMPOSITION</small><h2>多轨道编排</h2></div><div class="ws-toolbar"><button @click="add()">新增轨道</button><button @click="add('drag')">新增手势轨道</button><button @click="add('flip')">新增布局轨道</button></div></div>
 <p class="ws-hint">每条轨道拥有独立动效、延迟、时长及参数；共享全局播放时间。支持静态动效、录制手势和实时测量的内置布局场景。</p>
 <div class="ws-toolbar"><button @click="download(JSON.stringify(snapshot(),null,2),'motion-project.json')">导出编排 JSON</button><button @click="download(projectHtml(snapshot()),'motion-project.html')">导出编排 HTML</button><button @click="download(projectCode(snapshot(),'Vue'),'Composition.vue')">Vue</button><button @click="download(projectCode(snapshot(),'React'),'Composition.jsx')">React</button><button @click="download(projectZip(snapshot()),'motion-project.zip')">编排 ZIP</button><label class="ws-file">合并导入项目<input type="file" accept=".json,application/json" aria-label="导入编排项目" @change="loadProject"></label></div><p v-if="notice" role="status">{{notice}}</p><div class="ws-toolbar"><button :aria-pressed="!combined" @click="combined=false">独立预览</button><button :aria-pressed="combined" @click="combined=true">组合预览</button></div><CompositionStage v-if="combined" :tracks="tracks" :time="time"/><div v-else class="ws-composition-preview"><template v-for="t in tracks.filter(t=>!t.muted)" :key="t.id"><GestureTrack v-if="t.config.effect==='drag'" :track="t" :time="time-t.delay" @record="t.gesture=$event"/><CompositionStage v-else-if="t.config.effect==='flip'||t.config.effect==='shared'" :tracks="[t]" :time="time"/><Preview v-else :config="t.config" :time="time-t.delay" :label="t.name" :stress="1" scene="interface"/></template></div>
 <div class="ws-toolbar"><button @click="playing?pause():play()">{{playing?'暂停编排':'播放编排'}}</button><button @click="pause();seek(0)">归零</button><button :aria-pressed="loop" @click="loop=!loop">循环</button><label>缩放<select v-model.number="zoom" aria-label="编排缩放"><option :value="1">1×</option><option :value="2">2×</option><option :value="4">4×</option></select></label><label>吸附<select v-model.number="snap" aria-label="编排吸附"><option :value="0">关闭</option><option :value="20">20ms</option><option :value="50">50ms</option><option :value="100">100ms</option></select></label></div>
 <input type="range" aria-label="编排时间轴" min="0" :max="total" :value="Math.round(time)" @input="scrub">
 <div class="ws-composition-scroll"><div :style="{width}">
 <div class="ws-composition-ruler"><span v-for="n in 5" :key="n">{{Math.round(total*(n-1)/4)}}ms</span></div>
 <div v-for="t in tracks" :key="t.id" class="ws-composition-row">
  <button :aria-pressed="active===t.id" @click="active=t.id">{{t.name}}</button>
  <div class="ws-composition-track" @click="active=t.id"><i :class="{muted:t.muted}" :style="{left:percent(shownDelay(t))+'%',width:percent(trackLength(t))+'%'}" @pointerdown.stop="beginDrag($event,t)" @pointermove="moveTrack" @pointerup.stop="finishTrack($event,true)" @pointercancel="finishTrack($event,false)" @lostpointercapture="finishTrack($event,false)" title="拖动调整延迟"></i><button v-for="f in t.config.frames" :key="f.offset" class="ws-composition-marker" :style="{left:percent(t.delay+f.offset*t.config.duration)+'%'}" :aria-label="t.name+' 关键帧 '+Math.round(f.offset*100)+'%'" @click.stop="active=t.id;selectFrame(f.offset)">◆</button><span :style="{left:percent(time)+'%'}"></span></div>
 </div></div></div>
 <div v-if="current" class="ws-track-editor"><h3>选中轨道</h3><label>名称<input v-model="current.name" maxlength="80" aria-label="轨道名称"></label><label>动效<select :value="current.config.effect" aria-label="轨道动效" @change="changeEffect(current,($event.target as HTMLSelectElement).value as Effect)"><option v-for="e in effects" :key="e.id" :value="e.id">{{e.title}}</option></select></label><label>延迟 (ms)<input type="number" min="0" max="10000" :value="current.delay" aria-label="轨道延迟" @change="delay(current,Number(($event.target as HTMLInputElement).value))"></label><label>时长 (ms)<input type="number" min="0" max="3000" :value="current.config.duration" aria-label="轨道时长" @change="editDuration(current,$event)"></label><label>分组<input v-model="current.group" maxlength="80" aria-label="轨道分组"></label><div class="ws-toolbar" v-if="current.group"><button @click="moveGroup(current,-(snap||20))">组前移</button><button @click="moveGroup(current,snap||20)">组后移</button></div><div class="ws-track-parameters"><ParameterPanel :config="current.config" :selected="selectedFrame" @select="selectFrame" @move="moveFrame" @add="addFrame" @remove="removeFrame"/></div><div class="ws-toolbar"><button @click="current.muted=!current.muted">{{current.muted?'取消静音':'静音'}}</button><button @click="reorder(current.id,-1)">上移</button><button @click="reorder(current.id,1)">下移</button><button @click="remove(current.id)">删除轨道</button></div></div>
 <p v-if="error" role="status">{{error}}</p>
</section>
</template>
