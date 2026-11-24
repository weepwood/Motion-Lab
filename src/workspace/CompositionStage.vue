<script setup lang="ts">
import {computed,ref,watch,onMounted,onBeforeUnmount,nextTick} from 'vue'
import {mountComposition} from '../../packages/motion/index.js'
import {projectTracks,type Track} from './project'
const props=defineProps<{tracks?:Track[];track?:Track;time:number}>()
const source=computed(()=>props.track?[props.track]:props.tracks??[])
const root=ref<HTMLElement|null>(null)
let player:ReturnType<typeof mountComposition>|undefined,generation=0
async function rebuild(){const token=++generation;player?.dispose();player=undefined;await nextTick();if(token!==generation||!root.value)return;player=mountComposition(root.value,projectTracks({version:1,tracks:source.value}));player.seek(props.time)}
watch(source,rebuild,{deep:true})
watch(()=>props.time,t=>player?.seek(t))
onMounted(rebuild)
onBeforeUnmount(()=>{generation++;player?.dispose()})
</script>
<template><div ref="root" class="ws-combined-stage" aria-label="组合预览"></div></template>
