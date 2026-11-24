<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { animateLayout, captureLayout, attachSpringDrag, cancelLayout, play } from '../../packages/motion/index.js'
import { keyframes, easingOf, isTimeline, type Config } from './model'
import { gestureFrames, type GestureSample } from './gestureRecording'
const props=defineProps<{ config: Config; time: number; label: string; stress: number; scene?: 'object'|'interface'|'notification' }>()
const root=ref<HTMLElement|null>(null), order=ref([1,2,3,4]), expanded=ref(false)
let animations:Animation[]=[], detach:(()=>void)|undefined, generation=0
const recorded=ref<GestureSample[]>([])
let recordingPlayback:Animation|null=null
let dragged: HTMLElement | undefined
function clear(){recordingPlayback?.cancel();recordingPlayback=null;animations.forEach(a=>a.cancel());animations=[];detach?.();detach=undefined;if(dragged){dragged.style.transform='';dragged=undefined}if(root.value)cancelLayout(root.value.querySelectorAll('.ws-object'))}
function objects(){return Array.from(root.value?.querySelectorAll<HTMLElement>('.ws-object')??[])}
function seek(){for(const a of animations)a.currentTime=props.time}
async function prepare(){const token=++generation;clear();await nextTick();if(token!==generation)return
 if(isTimeline(props.config.effect)){
   if(matchMedia('(prefers-reduced-motion: reduce)').matches)return
   for(const [i,el] of objects().entries()){
     const a=play(el,keyframes(props.config),props.config.duration,easingOf(props.config),{delay:props.config.effect==='stagger'?i*props.config.stagger:0,fill:'both'})
     if(a){a.pause();animations.push(a)}
   }
   seek()
 } else if(props.config.effect==='drag'){
   const el=objects()[0];if(el){dragged=el;detach=attachSpringDrag(el,{duration:props.config.duration,physics:props.config.physics,onRecord:samples=>{recorded.value=samples},onInterrupt:()=>recordingPlayback?.cancel()})}
 }
}
function replayGesture(){const el=objects()[0];if(!el||recorded.value.length<2||matchMedia('(prefers-reduced-motion: reduce)').matches)return;el.getAnimations().forEach(a=>a.cancel());recordingPlayback=play(el,gestureFrames(recorded.value),Math.max(1,recorded.value.at(-1)?.t??0),'linear');}
async function replay(){
 if(!root.value)return
 const before=captureLayout(objects())
 if(props.config.effect==='flip'){order.value=[...order.value.slice(1),order.value[0]];await nextTick();animateLayout(before,{duration:props.config.duration,easing:easingOf(props.config),physics:props.config.physics})}
 if(props.config.effect==='shared'){expanded.value=!expanded.value;await nextTick();animateLayout(before,{duration:props.config.duration,easing:easingOf(props.config),physics:props.config.physics})}
}
watch(()=>[props.config,props.stress,props.scene],prepare,{deep:true,immediate:true})
watch(()=>props.time,seek)
onBeforeUnmount(()=>{generation++;clear()})
defineExpose({replay})
</script>
<template>
 <section ref="root" class="ws-lane" :aria-label="label">
  <span class="ws-lane-label">{{label}}</span>
  <div v-if="config.effect==='flip'" class="ws-tiles"><div v-for="id in order" :key="id" class="ws-object ws-tile">{{id}}</div></div>
  <div v-else-if="config.effect==='shared'" class="ws-shared" :class="{expanded}"><div class="ws-object ws-tile">共享对象</div></div>
  <div v-else class="ws-objects" :class="{many: config.effect==='stagger'||stress>1}">
    <div v-for="i in config.effect==='stagger'?4:stress" :key="i" class="ws-object" :class="{draggable:config.effect==='drag','ws-interface-object':scene!=='object'&&scene!==undefined&&stress===1&&config.effect!=='stagger'&&config.effect!=='drag'}"><template v-if="scene!=='object'&&scene!==undefined&&stress===1&&config.effect!=='stagger'&&config.effect!=='drag'"><div class="ws-scene-icon">{{scene==='notification'?'✓':'M'}}</div><b>{{scene==='notification'?'任务已完成':'Motion preview'}}</b><span>{{scene==='notification'?'操作成功 · 通知反馈':'交互反馈 · 动效实验'}}</span><i></i><i></i></template><template v-else>{{config.effect==='drag'?'拖动':stress>1?i:''}}</template></div>
  </div>
  <div v-if="config.effect==='drag'" class="ws-gesture-controls"><button :disabled="recorded.length<2" @click="replayGesture">回放手势</button><small>{{recorded.length}} 个采样点</small></div>
  <button v-if="config.effect==='flip'||config.effect==='shared'" class="ws-action" @click="replay">执行布局转场</button>
 </section>
</template>
