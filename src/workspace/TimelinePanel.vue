<script setup lang="ts">
import { computed, ref } from 'vue'
import { Play, Pause, SkipBack, StepBack, StepForward, Repeat2 } from 'lucide-vue-next'
import { isTimeline, type Config } from './model'
const props=defineProps<{config:Config;baseline:Config|null;time:number;total:number;playing:boolean;speed:number;loop:boolean;selected:number|null}>()
const emit=defineEmits<{seek:[number];toggle:[];speed:[number];loop:[boolean];select:[number];move:[number,number]}>()
const dragging=ref<{offset:number;preview:number;id:number;left:number;width:number}|null>(null)
function startDrag(e:PointerEvent,offset:number){if(e.button!==0||!props.config.duration)return;const el=e.currentTarget as HTMLElement;const r=el.parentElement!.getBoundingClientRect();dragging.value={offset,preview:offset,id:e.pointerId,left:r.left,width:r.width};try{el.setPointerCapture(e.pointerId)}catch{/* synthetic pointer */}emit('select',offset)}
function dragMarker(e:PointerEvent){const d=dragging.value;if(!d||d.id!==e.pointerId||!d.width)return;d.preview=Math.round(Math.max(.01,Math.min(.99,(e.clientX-d.left)/d.width*props.total/props.config.duration))*100)/100}
function finishDrag(e:PointerEvent,commit:boolean){const d=dragging.value;if(!d||d.id!==e.pointerId)return;dragging.value=null;if(commit&&d.preview!==d.offset)emit('move',d.offset,d.preview)}
const markerOffset=(offset:number)=>dragging.value?.offset===offset?dragging.value.preview:offset
const enabled=computed(()=>isTimeline(props.config.effect))
const percent=(ms:number)=>Math.max(0,Math.min(100,props.total?ms/props.total*100:0))
const ticks=computed(()=>Array.from({length:5},(_,i)=>Math.round(props.total*i/4)))
function scrub(e:MouseEvent){if(!enabled.value)return;const r=(e.currentTarget as HTMLElement).getBoundingClientRect();if(r.width)emit('seek',Math.round(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*props.total))}
function move(e:KeyboardEvent,offset:number){if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();emit('move',offset,offset+(e.key==='ArrowRight' ? .01 : -.01))}
</script>
<template>
<section class="ws-timeline">
  <div class="ws-heading"><div><h2>时间轴</h2><small>60 FPS 编辑步长 · {{Math.round(time)}} / {{total}} ms</small></div>
    <div class="ws-toolbar ws-transport">
      <button :disabled="!enabled" aria-label="归零" title="归零" @click="emit('seek',0)"><SkipBack :size="15"/></button>
      <button :disabled="!enabled" aria-label="上一帧" title="上一帧" @click="emit('seek',time-1000/60)"><StepBack :size="15"/></button>
      <button :disabled="!enabled" class="ws-primary" :aria-label="playing?'暂停':'播放'" @click="emit('toggle')"><Pause v-if="playing" :size="15"/><Play v-else :size="15"/>{{playing?'暂停':'播放'}}</button>
      <button :disabled="!enabled" aria-label="下一帧" title="下一帧" @click="emit('seek',time+1000/60)"><StepForward :size="15"/></button>
      <button :disabled="!enabled" aria-label="循环播放" :aria-pressed="loop" title="循环播放" @click="emit('loop',!loop)"><Repeat2 :size="15"/></button>
      <select :value="speed" aria-label="播放速度" @change="emit('speed',Number(($event.target as HTMLSelectElement).value))"><option :value="1">1×</option><option :value=".5">0.5×</option><option :value=".25">0.25×</option><option :value=".1">0.1×</option></select>
    </div>
  </div>
  <input type="range" aria-label="时间轴" min="0" :max="Math.max(1,total)" step="1" :value="Math.round(time)" :disabled="!enabled" @input="emit('seek',Number(($event.target as HTMLInputElement).value))">
  <div class="ws-ruler"><span v-for="(tick,i) in ticks" :key="i">{{tick}} ms</span></div>
  <div v-if="enabled" class="ws-tracks">
    <div v-for="(lane,index) in baseline?[config,baseline]:[config]" :key="index" class="ws-track-row">
      <span class="ws-track-name">{{index?'B':'A'}} · {{lane.effect}}</span>
      <div class="ws-track" @click="scrub">
        <i :style="{width:percent(lane.duration)+'%'}"></i>
        <span v-if="lane.effect==='stagger'" v-for="n in 3" :key="n" class="ws-stagger-bar" :style="{left:percent(n*lane.stagger)+'%',width:percent(lane.duration)+'%',top:(n*4+3)+'px'}"></span>
        <button v-if="!index" v-for="frame in lane.frames" :key="frame.offset" class="ws-key-marker" :class="{selected:selected===frame.offset}" :style="{left:percent(markerOffset(frame.offset)*lane.duration)+'%'}" :aria-label="'关键帧 '+Math.round(frame.offset*100)+'%'" title="拖动或方向键移动关键帧" @pointerdown.stop="startDrag($event,frame.offset)" @pointermove="dragMarker" @pointerup.stop="finishDrag($event,true)" @pointercancel="finishDrag($event,false)" @lostpointercapture="finishDrag($event,false)" @click.stop="emit('select',frame.offset)" @keydown="move($event,frame.offset)">◆</button>
        <span class="ws-playhead" :style="{left:percent(time)+'%'}"></span>
      </div>
    </div>
  </div>
  <p v-else class="ws-hint">布局和拖拽使用真实 DOM 测量或指针输入，请在预览区操作；静态时间轴不模拟这些输入。</p>
</section>
</template>
