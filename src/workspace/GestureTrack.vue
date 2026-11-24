<script setup lang="ts">
import {ref,watch,onMounted,onBeforeUnmount,nextTick} from 'vue'
import {attachSpringDrag,play} from '../../packages/motion/index.js'
import {trackFrames,type Track} from './project'
import type {GestureSample} from './gestureRecording'
const props=defineProps<{track:Track;time:number}>()
const emit=defineEmits<{record:[GestureSample[]]}>()
const object=ref<HTMLElement|null>(null),recording=ref(false)
let detach:(()=>void)|undefined,animation:Animation|null=null,generation=0
function clear(){detach?.();detach=undefined;animation?.cancel();animation=null}
async function prepare(){const token=++generation;clear();await nextTick();const el=object.value;if(!el||token!==generation)return
 if(recording.value){detach=attachSpringDrag(el,{duration:props.track.config.duration,physics:props.track.config.physics,onRecord:s=>{emit('record',s)}})}
 else if(!matchMedia('(prefers-reduced-motion: reduce)').matches){animation=play(el,trackFrames(props.track),props.track.config.duration,'linear',{fill:'both'});animation?.pause();if(animation)animation.currentTime=props.time}
}
watch(()=>[props.track.config.duration,props.track.config.physics,recording.value],prepare,{deep:true})
watch(()=>props.track.gesture,()=>{if(!recording.value)void prepare()},{deep:true})
watch(()=>props.time,t=>{if(animation)animation.currentTime=t})
onMounted(prepare);onBeforeUnmount(()=>{generation++;clear()})
</script>
<template><section class="ws-lane" :aria-label="track.name"><span class="ws-lane-label">{{track.name}}</span><div ref="object" class="ws-object draggable">{{recording?'拖动':'轨迹'}}</div><div class="ws-gesture-controls"><button :aria-pressed="recording" @click="recording=!recording">{{recording?'结束录制':'录制轨迹'}}</button><small>{{track.gesture?.length??0}} 点</small></div></section></template>
