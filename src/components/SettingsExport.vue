<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Check, ClipboardCopy, Download, FileCode2, ListFilter, Search, Settings2, X } from 'lucide-vue-next'
import { buildEffectPrompt, buildSystemPrompt, exportableEffects, exportEffectDetails, frameworkLabels, styleLabels, type EffectId, type Framework, type ImplStyle } from '../aiExport'
import {settings,effectiveLevel} from '../settings'
const props=defineProps<{mobile?:boolean}>()
const emit=defineEmits<{toast:[text:string];close:[];settings:[]}>()
const effectTarget=defineModel<EffectId>('effect',{required:true})
const framework=defineModel<Framework>('framework',{required:true})
const implStyle=defineModel<ImplStyle>('style',{required:true})
const exportAll=defineModel<boolean>('all',{required:true})
const query=ref(''),view=ref<'prompt'|'details'>('prompt'),promptBox=ref<HTMLTextAreaElement|null>(null),closeButton=ref<HTMLButtonElement|null>(null)
const copied=ref(false),copyStatus=ref(''), output=ref<HTMLElement|null>(null), controls=ref<HTMLElement|null>(null)
const pane=ref<'config'|'result'>('config')
function showPane(next:'config'|'result'){pane.value=next;void nextTick(()=>{const target=next==='config'?controls.value:output.value;target?.focus({preventScroll:true})})}
function jumpToOutput(){showPane('result')}
const category=ref('all')
const groups: {name:string;ids:EffectId[]}[]=[
 {name:'消息交互',ids:['send','reaction','ripple','swipe','delete','enter']},
 {name:'界面转场',ids:['theme','push','chat','menu']},
 {name:'系统机制',ids:['levels','scroll']}
]
const effects=computed(()=>exportableEffects())
const filtered=computed(()=>groups.filter(group=>category.value==='all'||category.value===group.name).map(group=>({name:group.name,items:effects.value.filter(e=>group.ids.includes(e.id)&&(!query.value.trim()||(e.id+' '+e.title).toLowerCase().includes(query.value.trim().toLowerCase())))})).filter(g=>g.items.length))
const selected=computed(()=>effects.value.find(e=>e.id===effectTarget.value))
const options=computed(()=>({framework:framework.value,style:implStyle.value}))
const promptText=computed(()=>exportAll.value?buildSystemPrompt(options.value):buildEffectPrompt(effectTarget.value,options.value))
const details=computed(()=>exportAll.value?effects.value.map(e=>exportEffectDetails(e.id)): [exportEffectDetails(effectTarget.value)])
const shortFramework:Record<Framework,string>={react:'React',vue:'Vue 3',svelte:'Svelte',vanilla:'原生 JS'}
const shortStyle:Record<ImplStyle,string>={waapi:'WAAPI + CSS 变量',css:'CSS + 最小 JS','motion-lib':'动效库'}
const lines=computed(()=>promptText.value.split('\n').length)
watch(promptText,()=>{copied.value=false;copyStatus.value=''})
watch([category,query],()=>{const list=controls.value?.querySelector('.ae-effect-list');if(list)list.scrollTop=0})
onMounted(()=>closeButton.value?.focus())
async function copyPrompt(){
 try{
  if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable')
  await navigator.clipboard.writeText(promptText.value);copied.value=true;copyStatus.value='已复制完整提示词';emit('toast','提示词已复制')
 }catch{
  view.value='prompt';pane.value='result';await nextTick();promptBox.value?.focus();promptBox.value?.select();copyStatus.value='剪贴板不可用，已选中文本，请手动复制';emit('toast',copyStatus.value)
 }
}
function downloadPrompt(){
 const url=URL.createObjectURL(new Blob([promptText.value],{type:'text/markdown;charset=utf-8'}))
 const a=document.createElement('a');a.href=url;a.download=(exportAll.value?'motion-lab-ai-system':'motion-lab-ai-'+effectTarget.value)+'.md';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);emit('toast','已下载 .md 文件')
}
</script>
<template>
<section class="ai-export-workspace" aria-label="AI 复刻导出工作区">
 <header class="ae-header">
  <div class="ae-heading"><span class="ae-icon"><FileCode2 :size="22"/></span><div><p>Motion Lab / 导出</p><h1>AI 复刻导出</h1></div></div>
  <button ref="closeButton" class="ae-button ae-close" aria-label="关闭 AI 复刻导出" @click="emit('close')"><ArrowLeft :size="16"/><span>返回聊天</span></button>
 </header>
 <nav class="ae-narrow-nav" aria-label="导出工作区导航"><button :aria-pressed="pane==='config'" @click="showPane('config')">导出配置</button><button :aria-pressed="pane==='result'" @click="showPane('result')">生成结果</button></nav>
 <div class="ae-body" :data-pane="pane">
  <div ref="controls" class="ae-controls" tabindex="-1">
   <section class="ae-section">
    <h2><span>01</span> 导出范围</h2>
    <div class="ae-mode" role="group" aria-label="导出范围">
     <button :aria-pressed="!exportAll" @click="exportAll=false">单个动效</button><button :aria-pressed="exportAll" @click="exportAll=true">导出全套动效系统</button>
    </div>
    <template v-if="!exportAll">
     <label class="ae-search"><Search :size="16"/><input v-model="query" placeholder="搜索动效..." aria-label="搜索导出动效"><button v-if="query" aria-label="清空动效搜索" @click="query=''"><X :size="15"/></button></label>
     <div class="ae-category" role="group" aria-label="动效分类"><button v-for="item in ['all',...groups.map(g=>g.name)]" :key="item" :aria-pressed="category===item" @click="category=item">{{item==='all'?'全部':item}}</button></div>
     <p class="ae-selection"><span>当前选择</span><strong>{{selected?.title.split('（')[0]}}</strong></p>
     <div class="ae-effect-list" aria-label="选择要导出的动效">
      <div v-for="group in filtered" :key="group.name" class="ae-group">
       <h3>{{group.name}} <small>{{group.items.length}}</small></h3>
       <label v-for="effect in group.items" :key="effect.id" class="ae-effect" :class="{selected:effectTarget===effect.id}">
        <input v-model="effectTarget" type="radio" name="export-effect" :value="effect.id"><span>{{effect.title.split('（')[0]}}</span><Check v-if="effectTarget===effect.id" :size="15" aria-hidden="true"/>
       </label>
      </div>
      <p v-if="!filtered.length" class="ae-muted">没有匹配的动效</p>
     </div>
    </template>
    <p v-else class="ae-help">包含全部 {{effects.length}} 种动效、索引、完整参数和工程验收标准。</p>
   </section>
   <section class="ae-section">
    <h2><span>02</span> 目标环境</h2>
    <fieldset class="ae-framework"><legend>目标框架</legend><label v-for="(label,key) in frameworkLabels" :key="key" :class="{selected:framework===key}" :title="label"><input v-model="framework" type="radio" name="export-framework" :value="key" :aria-label="label">{{shortFramework[key]}}</label></fieldset>
    <label class="ae-select-label" for="ae-style">实现方式</label>
    <select id="ae-style" v-model="implStyle"><option v-for="(label,key) in shortStyle" :key="key" :value="key">{{label}}</option></select>
    <p class="ae-help">{{styleLabels[implStyle]}}</p>
   </section>
   <section class="ae-section ae-live">
    <h2><span>03</span> 当前配置 <small>实时同步</small></h2>
    <dl><div><dt>基础时长</dt><dd>{{settings.duration}} ms</dd></div><div><dt>有效动画等级</dt><dd>{{effectiveLevel}}</dd></div><div><dt>慢放倍数</dt><dd>{{settings.timeScale}}×</dd></div></dl>
    <button v-if="!props.mobile" class="ae-button ae-settings" @click="emit('settings')"><Settings2 :size="15"/> 调整左侧动画设置</button>
    <p class="ae-help">{{props.mobile?'返回聊天后可在动画设置中调整参数，重新打开导出时会保留选择。':'左侧设置与右侧生成结果实时同步。'}}</p>
   </section>
   <button class="ae-button ae-jump" @click="jumpToOutput">查看生成结果</button>
  </div>
  <div ref="output" class="ae-output" tabindex="-1">
   <div class="ae-output-heading"><div><p class="ae-kicker">生成结果 · {{shortFramework[framework]}}</p><h2>{{exportAll?'全套动效系统':selected?.title}}</h2><p class="ae-muted">{{exportAll?effects.length+' 个效果':'单个动效'}} · {{promptText.length.toLocaleString()}} 字符 · {{lines}} 行</p></div></div>
   <div class="ae-output-toolbar">
    <div class="ae-tabs" role="group" aria-label="输出视图"><button :aria-pressed="view==='prompt'" @click="view='prompt'"><FileCode2 :size="15"/> 提示词</button><button :aria-pressed="view==='details'" @click="view='details'"><ListFilter :size="15"/> 参数概览</button></div>
    <div class="ae-actions"><button class="ae-button" @click="downloadPrompt"><Download :size="16"/> 下载 .md</button><button class="ae-button ae-primary" @click="copyPrompt"><component :is="copied?Check:ClipboardCopy" :size="16"/>{{copied?'已复制':'复制提示词'}}</button></div>
   </div>
   <div v-show="view==='prompt'" class="ae-prompt"><textarea ref="promptBox" class="export-io" readonly :value="promptText" aria-label="AI 复刻提示词" spellcheck="false"></textarea></div>
   <div v-if="view==='details'" class="ae-details" aria-label="参数概览">
    <article v-for="detail in details" :key="detail.id"><h3>{{detail.title}}</h3><p>{{detail.summary}}</p><div class="ae-token-table"><table><thead><tr><th>参数</th><th>当前值</th><th>说明</th></tr></thead><tbody><tr v-for="token in detail.tokens" :key="token.name"><td>{{token.name}}</td><td><code>{{token.value}}</code></td><td>{{token.note}}</td></tr></tbody></table></div><h4>验收标准</h4><ul><li v-for="item in detail.acceptance" :key="item">{{item}}</li></ul></article>
   </div>
   <footer class="ae-footer"><span>Markdown + 机器可读 JSON · 使用当前配置生成</span><span role="status">{{copyStatus}}</span></footer>
  </div>
 </div>
</section>
</template>
