<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { catalog, defaults, styles, easingOf, isTimeline, timelineLength, sanitizeConfig, type Config, type Effect } from './model'
import { useAssets } from './assets'
import { codeFor, type Format } from './export'
import { usePlayback } from './usePlayback'
import Preview from './Preview.vue'
const config=ref<Config>(defaults()), baseline=ref<Config|null>(null)
const query=ref(''), category=ref('全部'), name=ref(''), activeAsset=ref(''), status=ref(''), io=ref(''), format=ref<Format>('JavaScript'), stress=ref(1)
const {store,error,favorite,save,importText}=useAssets()
const categories=['全部','转场','微交互','布局','手势','收藏']
const filtered=computed(()=>catalog.filter(x=>(category.value==='全部'||(category.value==='收藏'?store.value.favorites.includes(x.id):x.category===category.value))&&(x.title+' '+x.desc+' '+x.id).toLowerCase().includes(query.value.toLowerCase())))
const title=computed(()=>catalog.find(x=>x.id===config.value.effect)?.title)
const total=computed(()=>Math.max(timelineLength(config.value),baseline.value?timelineLength(baseline.value):0))
const {time,playing,speed,seek,pause,play}=usePlayback(()=>{},()=>total.value)
watch(config,()=>{pause();seek(0)},{deep:true})
function choose(id:Effect){config.value=defaults(id);activeAsset.value='';stress.value=1;baseline.value=null}
function apply(c:Config){config.value=sanitizeConfig(c)}
function editCurve(i:number,event:Event){const raw=Number((event.target as HTMLInputElement).value);if(Number.isFinite(raw))config.value.curve[i]=Math.max(i%2?-1:0,Math.min(i%2?2:1,raw))}
function preset(i:number){const s=styles[i];config.value={...config.value,duration:s.duration,curve:[...s.curve],bounce:s.bounce}}
const output=computed(()=>codeFor(config.value,format.value))
function addFrame(){if(config.value.effect==='spring'||!isTimeline(config.value.effect))return;const offset=Math.round(config.value.middle*100)/100;if(config.value.frames.some(x=>x.offset===offset))return;config.value.frames.push({offset,x:0,y:-20,scale:1,opacity:1});config.value.frames.sort((a,b)=>a.offset-b.offset)}
function saveAsset(revision=false){try{save(name.value,config.value,revision?activeAsset.value:undefined);status.value='预设已保存'}catch(e){status.value=String(e)}}
function loadAsset(id:string,index:number){const a=store.value.assets.find(x=>x.id===id);if(!a)return;apply(a.versions[index].config);activeAsset.value=id;name.value=a.name;status.value='已载入版本 '+(index+1)}
function importAssets(){try{importText(io.value);status.value='已合并导入（已有 ID 保留）'}catch(e){status.value=String(e)}}
function download(text:string,filename:string){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function copy(){try{await navigator.clipboard.writeText(output.value);status.value='已复制'}catch{status.value='复制不可用，请手动选择文本'}}
const intervals=ref<number[]>([]), measuring=ref(false)
let raf=0, last=0
function measure(){cancelAnimationFrame(raf);intervals.value=[];measuring.value=true;last=0;const samples:number[]=[];let begin=0;const tick=(now:number)=>{if(!begin)begin=now;if(last)samples.push(now-last);last=now;if(now-begin<2000){raf=requestAnimationFrame(tick)}else{intervals.value=samples;measuring.value=false}};raf=requestAnimationFrame(tick)}
onBeforeUnmount(()=>cancelAnimationFrame(raf))
const perf=computed(()=>{const a=[...intervals.value].sort((x,y)=>x-y);if(!a.length)return null;const median=a[Math.floor(a.length/2)];return {median,p95:a[Math.floor((a.length-1)*.95)],max:a[a.length-1],missed:a.reduce((s,x)=>s+Math.max(0,Math.round(x/median)-1),0),bins:[a.filter(x=>x<=median*1.5).length,a.filter(x=>x>median*1.5&&x<=median*2.5).length,a.filter(x=>x>median*2.5).length]}})
</script>
<template>
 <main class="ws">
  <header class="ws-top"><div><b>Motion Lab</b><span> / 交互动效工作台</span></div><nav><a href="./">聊天实验场</a><a href="./demo/">独立 Demo</a></nav></header>
  <aside class="ws-nav"><h2>动效资源</h2><input v-model="query" aria-label="搜索动效" placeholder="搜索动效…"><div class="ws-categories"><button v-for="c in categories" :key="c" :aria-pressed="category===c" @click="category=c">{{c}}</button></div>
   <div v-for="item in filtered" :key="item.id" class="ws-entry"><button :aria-pressed="config.effect===item.id" @click="choose(item.id)"><b>{{item.title}}</b><small>{{item.desc}}</small></button><button :aria-label="'收藏 '+item.title" :aria-pressed="store.favorites.includes(item.id)" @click="favorite(item.id)">{{store.favorites.includes(item.id)?'★':'☆'}}</button></div>
   <p v-if="!filtered.length">暂无匹配动效</p>
   <h2>研究预设</h2><div v-for="(s,i) in styles" :key="s.name" class="ws-study"><button @click="preset(i)">{{s.name}}</button><a :href="s.url" target="_blank" rel="noopener">参考：{{s.source}}</a><small>独立近似，非官方实测值</small></div>
  </aside>
  <section class="ws-center"><div class="ws-heading"><div><small>WORKSPACE / {{config.effect}}</small><h1>{{title}}</h1></div><button @click="baseline=baseline?null:sanitizeConfig(config);seek(0)">{{baseline?'关闭 A/B':'固定为 B 对比'}}</button></div>
   <div class="ws-preview" :class="{compare:baseline}"><Preview :config="config" :time="time" label="A · 当前" :stress="stress"/><Preview v-if="baseline" :config="baseline" :time="time" label="B · 快照" :stress="1"/></div>
   <section class="ws-timeline"><div class="ws-heading"><h2>时间轴</h2><div class="ws-toolbar"><button :disabled="!isTimeline(config.effect)" @click="seek(0)">归零</button><button :disabled="!isTimeline(config.effect)" @click="playing?pause():play()">{{playing?'暂停':'播放'}}</button><button :disabled="!isTimeline(config.effect)" @click="pause();seek(time-1000/60)">上一帧</button><button :disabled="!isTimeline(config.effect)" @click="pause();seek(time+1000/60)">下一帧</button><select v-model.number="speed" aria-label="播放速度"><option :value="1">1×</option><option :value=".5">0.5×</option><option :value=".1">0.1×</option></select></div></div>
   <input type="range" aria-label="时间轴" min="0" :max="Math.max(1,total)" step="1" :value="time" :disabled="!isTimeline(config.effect)" @input="pause();seek(Number(($event.target as HTMLInputElement).value))"><div class="ws-ruler"><span>0 ms</span><span>{{Math.round(time)}} / {{total}} ms</span><span>{{total}} ms</span></div>
   <div v-if="isTimeline(config.effect)" class="ws-track"><i :style="{width:(total?config.duration/total*100:100)+'%'}"></i><b v-for="frame in config.frames" :key="frame.offset" :style="{left:frame.offset*100+'%'}">◆</b></div><p v-else>布局与手势使用真实交互，不支持静态时间轴拖动。</p></section>
   <section class="ws-performance"><h2>性能诊断</h2><div class="ws-toolbar"><button :disabled="!isTimeline(config.effect)||config.effect==='stagger'" @click="stress=stress===1?80:1">{{stress===1?'80 元素压力测试':'结束压力测试'}}</button><button :disabled="measuring" @click="measure">{{measuring?'采样中…':'采样 2 秒'}}</button></div><p v-if="perf">中位帧时间 {{perf.median.toFixed(1)}} ms · P95 {{perf.p95.toFixed(1)}} ms · 最长 {{perf.max.toFixed(1)}} ms · 估算漏帧 {{perf.missed}}</p><div v-if="perf" class="ws-hist"><div v-for="(n,i) in perf.bins" :key="i"><i :style="{width:(n/intervals.length*100)+'%'}"></i><span>{{['正常','1.5–2.5 倍','>2.5 倍'][i]}} · {{n}}</span></div></div><small>基于 requestAnimationFrame 间隔的估算，不等同于 GPU 实际掉帧。</small></section>
  </section>
  <aside class="ws-inspector"><h2>参数检查器</h2>
   <label>时长 <output>{{config.duration}} ms</output><input v-model.number="config.duration" type="range" min="0" max="2000" step="10"></label>
   <label>位移 <output>{{config.distance}} px</output><input v-model.number="config.distance" type="range" min="0" max="240"></label>
   <label>回弹 <output>{{config.bounce.toFixed(2)}}</output><input v-model.number="config.bounce" type="range" min="0" max=".6" step=".01"></label>
   <label>级联间隔 <output>{{config.stagger}} ms</output><input v-model.number="config.stagger" type="range" min="0" max="200"></label>
   <h3>缓动曲线</h3><svg viewBox="0 0 180 110" class="ws-curve" role="img" aria-label="贝塞尔曲线"><path d="M10 100 L170 10" stroke="#626979" stroke-dasharray="4 4"/><path :d="'M10 100 C'+(10+160*config.curve[0])+' '+(100-90*config.curve[1])+', '+(10+160*config.curve[2])+' '+(100-90*config.curve[3])+', 170 10'" stroke="#769fff" fill="none" stroke-width="2"/></svg>
   <div class="ws-curve-input"><label v-for="(_,i) in config.curve" :key="i">{{['X1','Y1','X2','Y2'][i]}}<input type="number" step=".05" :min="i%2?-1:0" :max="i%2?2:1" :value="config.curve[i]" @change="editCurve(i,$event)"></label></div><small>{{easingOf(config)}}</small>
   <template v-if="isTimeline(config.effect)&&config.effect!=='spring'"><h3>关键帧</h3><label>插入位置<input v-model.number="config.middle" type="range" min=".05" max=".95" step=".05"></label><button @click="addFrame">添加关键帧 {{Math.round(config.middle*100)}}%</button><div v-for="(frame,i) in config.frames" :key="frame.offset" class="ws-keyframe"><b>{{Math.round(frame.offset*100)}}%</b><label>X<input v-model.number="frame.x" type="number" min="-300" max="300"></label><label>Y<input v-model.number="frame.y" type="number" min="-300" max="300"></label><label>Scale<input v-model.number="frame.scale" type="number" min=".1" max="3" step=".1"></label><label>Opacity<input v-model.number="frame.opacity" type="number" min="0" max="1" step=".1"></label><button @click="config.frames.splice(i,1)">删除</button></div></template>
   <h3>本地预设与版本</h3><input v-model="name" aria-label="预设名称" placeholder="命名预设"><div class="ws-toolbar"><button @click="saveAsset()">保存新预设</button><button :disabled="!activeAsset" @click="saveAsset(true)">保存新版本</button></div><div v-for="a in store.assets" :key="a.id" class="ws-asset"><b>{{a.name}}</b><button v-for="(rev,i) in a.versions" :key="i" @click="loadAsset(a.id,i)">版本 {{a.versions.length-i}} · {{rev.at.slice(0,10)}}</button></div>
   <textarea v-model="io" aria-label="资产 JSON" placeholder="粘贴资产 JSON（合并导入）"></textarea><div class="ws-toolbar"><button @click="importAssets">导入</button><button @click="download(JSON.stringify(store,null,2),'motion-assets.json')">导出资产</button></div>
   <h3>代码与 AI 导出</h3><select v-model="format" aria-label="导出格式"><option v-for="fmt in ['Vue','React','JavaScript','CSS','Tokens','AI']" :key="fmt">{{fmt}}</option></select><textarea readonly :value="output" aria-label="生成代码"></textarea><div class="ws-toolbar"><button @click="copy">复制</button><button @click="download(output,'motion-'+format.toLowerCase()+'.txt')">下载</button></div><p v-if="error||status" role="status">{{error||status}}</p>
  </aside>
 </main>
</template>
<style src="./workspace.css"></style>
