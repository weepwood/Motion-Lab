<script setup lang="ts">
import {ref,watch,onMounted,onBeforeUnmount,nextTick} from 'vue'
import {mountComposition} from '../../packages/motion/index.js'
import {projectTracks,type Track} from './project'
const props=defineProps<{tracks:Track[];time:number}>()
const root=ref<HTMLElement|null>(null)
let player:ReturnType<typeof mountComposition>|undefined,generation=0,observer:ResizeObserver|undefined,raf=0,lastWidth=0
async function rebuild(){const token=++generation;player?.dispose();player=undefined;await nextTick();if(token!==generation||!root.value)return;player=mountComposition(root.value,projectTracks({version:1,tracks:props.tracks}));player.seek(props.time)}
watch(()=>props.tracks,rebuild,{deep:true})
watch(()=>props.time,t=>player?.seek(t))
onMounted(()=>{void rebuild();if(root.value&&typeof ResizeObserver!=='undefined'){lastWidth=root.value.clientWidth;observer=new ResizeObserver(()=>{const w=root.value?.clientWidth??0;if(w===lastWidth)return;lastWidth=w;cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>player?.refresh())});observer.observe(root.value)}})
onBeforeUnmount(()=>{generation++;cancelAnimationFrame(raf);observer?.disconnect();player?.dispose()})
</script>
<template><div ref="root" class="ws-combined-stage" aria-label="组合预览"></div></template>
