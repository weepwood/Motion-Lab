<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { animateLayout, captureLayout, drag, cancelLayout, play } from '../../packages/motion/index.js'
import { keyframes, easingOf, isTimeline, type Config } from './model'
const props=defineProps<{ config: Config; time: number; label: string; stress: number }>()
const root=ref<HTMLElement|null>(null), order=ref([1,2,3,4]), expanded=ref(false)
let animations:Animation[]=[], detach:(()=>void)|undefined, generation=0
let dragged: HTMLElement | undefined
let dragReturn: Animation | null = null
function clear(){animations.forEach(a=>a.cancel());animations=[];detach?.();detach=undefined;dragReturn?.cancel();dragReturn=null;if(dragged){dragged.style.transform='';dragged=undefined}if(root.value)cancelLayout(root.value.querySelectorAll('.ws-object'))}
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
   const el=objects()[0];if(el){dragged=el;let baseX=0,baseY=0;detach=drag(el,{onStart:()=>{el.getAnimations().forEach(a=>a.cancel());baseX=0;baseY=0},onUpdate:({dx,dy})=>{baseX=dx;baseY=dy;el.style.transform='translate('+dx+'px,'+dy+'px)'},onEnd:()=>{el.style.transform='';if(!matchMedia('(prefers-reduced-motion: reduce)').matches)dragReturn=play(el,[{transform:'translate('+baseX+'px,'+baseY+'px)'},{transform:'none'}],props.config.duration,easingOf(props.config))}})}
 }
}
async function replay(){
 if(!root.value)return
 const before=captureLayout(objects())
 if(props.config.effect==='flip'){order.value=[...order.value.slice(1),order.value[0]];await nextTick();animateLayout(before,{duration:props.config.duration,easing:easingOf(props.config)})}
 if(props.config.effect==='shared'){const source=objects()[0];if(!source)return;const rect=source.getBoundingClientRect();expanded.value=!expanded.value;await nextTick();const target=objects()[0];if(target)animateLayout(new Map([[target,rect]]),{duration:props.config.duration,easing:easingOf(props.config)})}
}
watch(()=>[props.config,props.stress],prepare,{deep:true,immediate:true})
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
    <div v-for="i in config.effect==='stagger'?4:stress" :key="i" class="ws-object" :class="{draggable:config.effect==='drag'}">{{config.effect==='drag'?'拖动':stress>1?i:''}}</div>
  </div>
  <button v-if="config.effect==='flip'||config.effect==='shared'" class="ws-action" @click="replay">执行布局转场</button>
 </section>
</template>
