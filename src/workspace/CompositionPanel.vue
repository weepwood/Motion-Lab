<script setup lang="ts">
import {computed,watch} from 'vue'
import {useComposition,type Track} from './composition'
import {usePlayback} from './usePlayback'
import {catalog,isTimeline,defaults,timelineLength,type Effect} from './model'
import Preview from './Preview.vue'
const {tracks,active,error,zoom,snap,total,current,add,remove,reorder,delay}=useComposition()
const {time,playing,loop,seek,pause,play}=usePlayback(()=>{},()=>total.value)
const effects=catalog.filter(e=>isTimeline(e.id))
const width=computed(()=>Math.max(100,zoom.value*100)+'%')
const percent=(ms:number)=>ms/total.value*100
function changeEffect(t:Track,value:Effect){const duration=t.config.duration;t.config=defaults(value);t.config.duration=duration}
function editDuration(t:Track,e:Event){const n=Number((e.target as HTMLInputElement).value);if(Number.isFinite(n))t.config.duration=Math.max(0,Math.min(3000,n))}
function scrub(e:Event){pause();seek(Number((e.target as HTMLInputElement).value))}
watch(total,()=>{seek(time.value)})
</script>
<template>
<section class="ws-composition">
 <div class="ws-heading"><div><small>COMPOSITION</small><h2>多轨道编排</h2></div><button @click="add()">新增轨道</button></div>
 <p class="ws-hint">每条轨道拥有独立动效、延迟、时长及参数；共享全局播放时间。仅支持静态关键帧类型。</p>
 <div class="ws-composition-preview"><Preview v-for="t in tracks.filter(t=>!t.muted)" :key="t.id" :config="t.config" :time="time-t.delay" :label="t.name" :stress="1" scene="interface"/></div>
 <div class="ws-toolbar"><button @click="playing?pause():play()">{{playing?'暂停编排':'播放编排'}}</button><button @click="pause();seek(0)">归零</button><button :aria-pressed="loop" @click="loop=!loop">循环</button><label>缩放<select v-model.number="zoom" aria-label="编排缩放"><option :value="1">1×</option><option :value="2">2×</option><option :value="4">4×</option></select></label><label>吸附<select v-model.number="snap" aria-label="编排吸附"><option :value="0">关闭</option><option :value="20">20ms</option><option :value="50">50ms</option><option :value="100">100ms</option></select></label></div>
 <input type="range" aria-label="编排时间轴" min="0" :max="total" :value="Math.round(time)" @input="scrub">
 <div class="ws-composition-scroll"><div :style="{width}">
 <div class="ws-composition-ruler"><span v-for="n in 5" :key="n">{{Math.round(total*(n-1)/4)}}ms</span></div>
 <div v-for="t in tracks" :key="t.id" class="ws-composition-row">
  <button :aria-pressed="active===t.id" @click="active=t.id">{{t.name}}</button>
  <div class="ws-composition-track" @click="active=t.id"><i :class="{muted:t.muted}" :style="{left:percent(t.delay)+'%',width:percent(timelineLength(t.config))+'%'}"></i><span :style="{left:percent(time)+'%'}"></span></div>
 </div></div></div>
 <div v-if="current" class="ws-track-editor"><h3>选中轨道</h3><label>名称<input v-model="current.name" maxlength="80" aria-label="轨道名称"></label><label>动效<select :value="current.config.effect" aria-label="轨道动效" @change="changeEffect(current,($event.target as HTMLSelectElement).value as Effect)"><option v-for="e in effects" :key="e.id" :value="e.id">{{e.title}}</option></select></label><label>延迟 (ms)<input type="number" min="0" max="10000" :value="current.delay" aria-label="轨道延迟" @change="delay(current,Number(($event.target as HTMLInputElement).value))"></label><label>时长 (ms)<input type="number" min="0" max="3000" :value="current.config.duration" aria-label="轨道时长" @change="editDuration(current,$event)"></label><label>位移<input v-model.number="current.config.distance" type="range" min="0" max="240"></label><div class="ws-toolbar"><button @click="current.muted=!current.muted">{{current.muted?'取消静音':'静音'}}</button><button @click="reorder(current.id,-1)">上移</button><button @click="reorder(current.id,1)">下移</button><button @click="remove(current.id)">删除轨道</button></div></div>
 <p v-if="error" role="status">{{error}}</p>
</section>
</template>
