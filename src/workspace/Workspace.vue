<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Activity, Code2, FolderOpen, SlidersHorizontal } from 'lucide-vue-next'
import WorkspaceLibrary from './WorkspaceLibrary.vue'
import TimelinePanel from './TimelinePanel.vue'
import { useFrameMetrics } from './useFrameMetrics'
import ParameterPanel from './ParameterPanel.vue'
import AssetPanel from './AssetPanel.vue'
import { htmlFor } from './htmlExport'
import { exportPack } from './exportPack'
import { catalog, defaults, styles, easingOf, isTimeline, timelineLength, sanitizeConfig, type Config, type Effect } from './model'
import { useAssets } from './assets'
import { codeFor, extensionFor, type Format } from './export'
import { usePlayback } from './usePlayback'
import Preview from './Preview.vue'
import CompositionPanel from './CompositionPanel.vue'
const config=ref<Config>(defaults()), baseline=ref<Config|null>(null)
const composition=ref(false),scene=ref<'object'|'interface'>('object')
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
function choose(id:Effect){config.value=defaults(id);activeAsset.value='';stress.value=1;baseline.value=null;selected.value=null;scrub(0)}
function apply(c:Config){config.value=sanitizeConfig(c);selected.value=null;baseline.value=null;stress.value=1;scrub(0)}
function preset(i:number){const s=styles[i];config.value={...config.value,duration:s.duration,curve:[...s.curve],bounce:s.bounce}}
const output=computed(()=>codeFor(config.value,format.value))
function addFrame(){if(config.value.frames.length>=30||config.value.effect==='spring'||!isTimeline(config.value.effect))return;const offset=Math.round(config.value.middle*100)/100;if(config.value.frames.some(x=>x.offset===offset))return;config.value.frames.push({offset,x:0,y:-20,scale:1,opacity:1});config.value.frames.sort((a,b)=>a.offset-b.offset);selectFrame(offset)}
function saveAsset(name:string,revision=false){try{activeAsset.value=save(name,config.value,revision?activeAsset.value:undefined);status.value='预设已保存'}catch(e){status.value=String(e)}}
function loadAsset(id:string,index:number){const a=store.value.assets.find(x=>x.id===id);if(!a)return;apply(a.versions[index].config);activeAsset.value=id;status.value='已载入版本 '+(index+1)}
function importAssets(text:string){try{importText(text);status.value='已合并导入（已有 ID 保留）'}catch(e){status.value=String(e)}}
function download(text:string|Blob,filename:string){const url=URL.createObjectURL(typeof text==='string'?new Blob([text],{type:'text/plain;charset=utf-8'}):text);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function archiveAssets(ids:string[],restore:boolean){archive(ids,restore);if(!restore&&ids.includes(activeAsset.value))activeAsset.value=''}
function compareVersion(c:Config){if(c.effect!==config.value.effect){status.value='请选择相同动效类型后对比';return}baseline.value=sanitizeConfig(c);scrub(0)}
function exportHtml(){download(htmlFor(config.value),'motion-'+config.value.effect+'.html')}
async function copy(){try{await navigator.clipboard.writeText(output.value);status.value='已复制'}catch{status.value='复制不可用，请手动选择文本'}}
const {intervals,measuring,measure,perf}=useFrameMetrics()
</script>
<template>
 <main class="ws" :class="{'ws-composing':composition}">
  <header class="ws-top"><div><b>Motion Lab</b><span> / 交互动效工作台</span></div><nav><a href="./">聊天实验场</a><a href="./demo/">独立 Demo</a></nav></header>
  <WorkspaceLibrary :active="config.effect" :favorites="store.favorites" @choose="choose" @favorite="favorite" @preset="preset"/>
  <section class="ws-center"><div class="ws-mode-switch"><button :aria-pressed="!composition" @click="composition=false">单动效</button><button :aria-pressed="composition" @click="pause();composition=true">多轨道</button></div><CompositionPanel v-if="composition"/><template v-else><div class="ws-heading"><div><small>WORKSPACE / {{config.effect}}</small><h1>{{title}}</h1></div><button @click="baseline=baseline?null:sanitizeConfig(config);seek(0)">{{baseline?'关闭 A/B':'固定为 B 对比'}}</button></div>
   <div class="ws-scene-switch"><button :aria-pressed="scene==='object'" @click="scene='object'">基础对象</button><button :aria-pressed="scene==='interface'" @click="scene='interface'">界面卡片</button></div><div class="ws-preview" :class="{compare:baseline}"><Preview :config="config" :time="time" label="A · 当前" :stress="stress" :scene="scene"/><Preview v-if="baseline" :config="baseline" :time="time" label="B · 快照" :stress="1" :scene="scene"/></div>
   <TimelinePanel :config="config" :baseline="baseline" :time="time" :total="total" :playing="playing" :speed="speed" :loop="loop" :selected="selected" @seek="scrub" @toggle="playing?pause():play()" @speed="speed=$event" @loop="loop=$event" @select="selectFrame" @move="moveFrame"/>
   <section class="ws-performance"><h2 class="ws-inline-title"><Activity :size="15"/> 性能诊断</h2><div class="ws-toolbar"><button :disabled="!isTimeline(config.effect)||config.effect==='stagger'" @click="stress=stress===1?80:1">{{stress===1?'80 元素压力测试':'结束压力测试'}}</button><button :disabled="measuring" @click="measure">{{measuring?'采样中…':'采样 2 秒'}}</button></div><p v-if="perf">中位帧时间 {{perf.median.toFixed(1)}} ms · P95 {{perf.p95.toFixed(1)}} ms · 最长 {{perf.max.toFixed(1)}} ms · 估算漏帧 {{perf.missed}}</p><div v-if="perf" class="ws-hist"><div v-for="(n,i) in perf.bins" :key="i"><i :style="{width:(n/intervals.length*100)+'%'}"></i><span>{{['正常','1.5–2.5 倍','>2.5 倍'][i]}} · {{n}}</span></div></div><small>基于 requestAnimationFrame 间隔的估算，不等同于 GPU 实际掉帧。</small></section>
  </template></section>
  <aside v-if="!composition" class="ws-inspector"><div class="ws-section-label"><h2>检查器</h2><span>{{config.effect}}</span></div><div class="ws-inspector-tabs" role="group" aria-label="检查器分组"><button v-for="tab in tabs" :key="tab.id" :aria-pressed="inspector===tab.id" @click="inspector=tab.id"><component :is="tab.icon" :size="15"/>{{tab.label}}</button></div><div v-show="inspector==='parameters'" class="ws-inspector-content">
   <ParameterPanel :config="config" :selected="selected" @select="selectFrame" @move="moveFrame" @add="addFrame" @remove="config.frames.splice($event,1);selected=null"/>
   </div><div v-show="inspector==='assets'" class="ws-inspector-content"><AssetPanel :assets="store.assets" :active="activeAsset" @save="saveAsset" @load="loadAsset" @compare="compareVersion" @rename="rename" @archive="archiveAssets" @purge="purge" @import="importAssets" @export="download(JSON.stringify(store,null,2),'motion-assets.json')"/></div><div v-show="inspector==='export'" class="ws-inspector-content"><h3>代码与 AI 导出</h3><select v-model="format" aria-label="导出格式"><option v-for="fmt in ['Vue','React','JavaScript','CSS','Tokens','AI']" :key="fmt">{{fmt}}</option></select><textarea readonly :value="output" aria-label="生成代码"></textarea><div class="ws-toolbar"><button @click="copy">复制</button><button @click="download(output,'motion-'+config.effect+'.'+extensionFor(format))">下载</button><button @click="exportHtml">独立 HTML</button><button @click="download(exportPack(config),'motion-'+config.effect+'.zip')">完整 ZIP</button></div></div><p v-if="error||status" role="status" class="ws-status">{{error||status}}</p>
  </aside>
 </main>
</template>
<style src="./workspace.css"></style>
