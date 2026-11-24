<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Activity, Code2, FolderOpen, SlidersHorizontal } from 'lucide-vue-next'
import WorkspaceLibrary from './WorkspaceLibrary.vue'
import TimelinePanel from './TimelinePanel.vue'
import { useFrameMetrics } from './useFrameMetrics'
import CurveEditor from '../components/CurveEditor.vue'
import AssetPanel from './AssetPanel.vue'
import { htmlFor } from './htmlExport'
import { catalog, defaults, styles, easingOf, isTimeline, timelineLength, sanitizeConfig, type Config, type Effect, type Frame } from './model'
import { useAssets } from './assets'
import { codeFor, extensionFor, type Format } from './export'
import { usePlayback } from './usePlayback'
import Preview from './Preview.vue'
const config=ref<Config>(defaults()), baseline=ref<Config|null>(null)
const activeAsset=ref(''), status=ref(''), format=ref<Format>('JavaScript'), stress=ref(1)
const {store,error,favorite,save,importText,rename,archive,purge}=useAssets()
const title=computed(()=>catalog.find(x=>x.id===config.value.effect)?.title)
const total=computed(()=>Math.max(timelineLength(config.value),baseline.value?timelineLength(baseline.value):0))
const {time,playing,speed,loop,seek,pause,play}=usePlayback(()=>{},()=>total.value)
const selected=ref<number|null>(null)
const inspector=ref<'parameters'|'assets'|'export'>('parameters')
const tabs=[{id:'parameters',label:'参数',icon:SlidersHorizontal},{id:'assets',label:'资产',icon:FolderOpen},{id:'export',label:'导出',icon:Code2}] as const
watch(config,()=>{pause();seek(Math.min(time.value,total.value))},{deep:true})
function scrub(ms:number){pause();seek(ms)}
function selectFrame(offset:number){selected.value=offset;inspector.value='parameters';scrub(offset*config.value.duration)}
function moveFrame(from:number,to:number){if(!Number.isFinite(to))return;const offset=Math.round(Math.max(.01,Math.min(.99,to))*100)/100;const frame=config.value.frames.find(x=>x.offset===from);if(!frame||config.value.frames.some(x=>x!==frame&&x.offset===offset))return;frame.offset=offset;config.value.frames.sort((a,b)=>a.offset-b.offset);selectFrame(offset)}
function editFrame(frame:Frame,key:'x'|'y'|'scale'|'opacity',event:Event){const value=Number((event.target as HTMLInputElement).value);if(!Number.isFinite(value))return;const bounds=key==='scale'?[.1,3]:key==='opacity'?[0,1]:[-300,300];frame[key]=Math.max(bounds[0],Math.min(bounds[1],value))}
function choose(id:Effect){config.value=defaults(id);activeAsset.value='';stress.value=1;baseline.value=null;selected.value=null;scrub(0)}
function apply(c:Config){config.value=sanitizeConfig(c);selected.value=null;baseline.value=null;stress.value=1;scrub(0)}
function editCurve(i:number,event:Event){const raw=Number((event.target as HTMLInputElement).value);if(Number.isFinite(raw))config.value.curve[i]=Math.max(i%2?-1:0,Math.min(i%2?2:1,raw))}
function preset(i:number){const s=styles[i];config.value={...config.value,duration:s.duration,curve:[...s.curve],bounce:s.bounce}}
const output=computed(()=>codeFor(config.value,format.value))
function addFrame(){if(config.value.frames.length>=30||config.value.effect==='spring'||!isTimeline(config.value.effect))return;const offset=Math.round(config.value.middle*100)/100;if(config.value.frames.some(x=>x.offset===offset))return;config.value.frames.push({offset,x:0,y:-20,scale:1,opacity:1});config.value.frames.sort((a,b)=>a.offset-b.offset);selectFrame(offset)}
function saveAsset(name:string,revision=false){try{activeAsset.value=save(name,config.value,revision?activeAsset.value:undefined);status.value='预设已保存'}catch(e){status.value=String(e)}}
function loadAsset(id:string,index:number){const a=store.value.assets.find(x=>x.id===id);if(!a)return;apply(a.versions[index].config);activeAsset.value=id;status.value='已载入版本 '+(index+1)}
function importAssets(text:string){try{importText(text);status.value='已合并导入（已有 ID 保留）'}catch(e){status.value=String(e)}}
function download(text:string,filename:string){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function archiveAssets(ids:string[],restore:boolean){archive(ids,restore);if(!restore&&ids.includes(activeAsset.value))activeAsset.value=''}
function compareVersion(c:Config){if(c.effect!==config.value.effect){status.value='请选择相同动效类型后对比';return}baseline.value=sanitizeConfig(c);scrub(0)}
function exportHtml(){download(htmlFor(config.value),'motion-'+config.value.effect+'.html')}
async function copy(){try{await navigator.clipboard.writeText(output.value);status.value='已复制'}catch{status.value='复制不可用，请手动选择文本'}}
const {intervals,measuring,measure,perf}=useFrameMetrics()
</script>
<template>
 <main class="ws">
  <header class="ws-top"><div><b>Motion Lab</b><span> / 交互动效工作台</span></div><nav><a href="./">聊天实验场</a><a href="./demo/">独立 Demo</a></nav></header>
  <WorkspaceLibrary :active="config.effect" :favorites="store.favorites" @choose="choose" @favorite="favorite" @preset="preset"/>
  <section class="ws-center"><div class="ws-heading"><div><small>WORKSPACE / {{config.effect}}</small><h1>{{title}}</h1></div><button @click="baseline=baseline?null:sanitizeConfig(config);seek(0)">{{baseline?'关闭 A/B':'固定为 B 对比'}}</button></div>
   <div class="ws-preview" :class="{compare:baseline}"><Preview :config="config" :time="time" label="A · 当前" :stress="stress"/><Preview v-if="baseline" :config="baseline" :time="time" label="B · 快照" :stress="1"/></div>
   <TimelinePanel :config="config" :baseline="baseline" :time="time" :total="total" :playing="playing" :speed="speed" :loop="loop" :selected="selected" @seek="scrub" @toggle="playing?pause():play()" @speed="speed=$event" @loop="loop=$event" @select="selectFrame" @move="moveFrame"/>
   <section class="ws-performance"><h2 class="ws-inline-title"><Activity :size="15"/> 性能诊断</h2><div class="ws-toolbar"><button :disabled="!isTimeline(config.effect)||config.effect==='stagger'" @click="stress=stress===1?80:1">{{stress===1?'80 元素压力测试':'结束压力测试'}}</button><button :disabled="measuring" @click="measure">{{measuring?'采样中…':'采样 2 秒'}}</button></div><p v-if="perf">中位帧时间 {{perf.median.toFixed(1)}} ms · P95 {{perf.p95.toFixed(1)}} ms · 最长 {{perf.max.toFixed(1)}} ms · 估算漏帧 {{perf.missed}}</p><div v-if="perf" class="ws-hist"><div v-for="(n,i) in perf.bins" :key="i"><i :style="{width:(n/intervals.length*100)+'%'}"></i><span>{{['正常','1.5–2.5 倍','>2.5 倍'][i]}} · {{n}}</span></div></div><small>基于 requestAnimationFrame 间隔的估算，不等同于 GPU 实际掉帧。</small></section>
  </section>
  <aside class="ws-inspector"><div class="ws-section-label"><h2>检查器</h2><span>{{config.effect}}</span></div><div class="ws-inspector-tabs" role="group" aria-label="检查器分组"><button v-for="tab in tabs" :key="tab.id" :aria-pressed="inspector===tab.id" @click="inspector=tab.id"><component :is="tab.icon" :size="15"/>{{tab.label}}</button></div><div v-show="inspector==='parameters'" class="ws-inspector-content">
   <label>时长 <output>{{config.duration}} ms</output><input v-model.number="config.duration" type="range" min="0" max="2000" step="10"></label>
   <label>位移 <output>{{config.distance}} px</output><input v-model.number="config.distance" type="range" min="0" max="240"></label>
   <label>回弹 <output>{{config.bounce.toFixed(2)}}</output><input v-model.number="config.bounce" type="range" min="0" max=".6" step=".01"></label>
   <label>级联间隔 <output>{{config.stagger}} ms</output><input v-model.number="config.stagger" type="range" min="0" max="200"></label>
   <template v-if="config.effect==='spring'"><label class="ws-asset-check"><input type="checkbox" :checked="!!config.physics" @change="config.physics=($event.target as HTMLInputElement).checked?{mass:1,stiffness:180,damping:18,velocity:0}:undefined">物理弹簧模式</label><template v-if="config.physics"><label v-for="key in (['mass','stiffness','damping','velocity'] as const)" :key="key">{{key}} <output>{{config.physics[key]}}</output><input v-model.number="config.physics[key]" type="range" :min="key==='mass'?.1:key==='velocity'?-2000:1" :max="key==='mass'?5:key==='stiffness'?800:key==='damping'?80:2000" :step="key==='mass'?.1:1"></label></template></template>
   <h3>缓动曲线</h3><CurveEditor :easing-key="config.effect==='spring'?'spring':'custom'" :bezier="config.curve" :bounce="config.bounce" :duration="config.duration" :css="easingOf(config)" @drag="config.curve=$event"/>
   <div class="ws-curve-input"><label v-for="(_,i) in config.curve" :key="i">{{['X1','Y1','X2','Y2'][i]}}<input type="number" step=".05" :min="i%2?-1:0" :max="i%2?2:1" :value="config.curve[i]" @change="editCurve(i,$event)"></label></div><small>{{easingOf(config)}}</small>
   <template v-if="isTimeline(config.effect)&&config.effect!=='spring'"><h3>关键帧</h3><label>插入位置<input v-model.number="config.middle" type="range" min=".05" max=".95" step=".05"></label><button @click="addFrame">添加关键帧 {{Math.round(config.middle*100)}}%</button><div v-for="(frame,i) in config.frames" :key="i" class="ws-keyframe" :class="{selected:selected===frame.offset}"><button class="ws-frame-select" @click="selectFrame(frame.offset)">定位 {{Math.round(frame.offset*100)}}%</button><label>位置 %<input type="number" min="1" max="99" :value="Math.round(frame.offset*100)" @change="moveFrame(frame.offset,Number(($event.target as HTMLInputElement).value)/100)"></label><label v-for="key in (['x','y','scale','opacity'] as const)" :key="key">{{key}}<input type="number" :step="key==='scale'||key==='opacity' ? .1 : 1" :value="frame[key]" @change="editFrame(frame,key,$event)"></label><button @click="config.frames.splice(i,1);selected=null">删除</button></div></template>
   </div><div v-show="inspector==='assets'" class="ws-inspector-content"><AssetPanel :assets="store.assets" :active="activeAsset" @save="saveAsset" @load="loadAsset" @compare="compareVersion" @rename="rename" @archive="archiveAssets" @purge="purge" @import="importAssets" @export="download(JSON.stringify(store,null,2),'motion-assets.json')"/></div><div v-show="inspector==='export'" class="ws-inspector-content"><h3>代码与 AI 导出</h3><select v-model="format" aria-label="导出格式"><option v-for="fmt in ['Vue','React','JavaScript','CSS','Tokens','AI']" :key="fmt">{{fmt}}</option></select><textarea readonly :value="output" aria-label="生成代码"></textarea><div class="ws-toolbar"><button @click="copy">复制</button><button @click="download(output,'motion-'+config.effect+'.'+extensionFor(format))">下载</button><button @click="exportHtml">独立 HTML</button></div></div><p v-if="error||status" role="status" class="ws-status">{{error||status}}</p>
  </aside>
 </main>
</template>
<style src="./workspace.css"></style>
