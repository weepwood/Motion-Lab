<script setup lang="ts">
import CurveEditor from '../components/CurveEditor.vue'
import { easingOf,isTimeline,type Config,type Frame } from './model'
const props=defineProps<{config:Config;selected:number|null}>()
const emit=defineEmits<{select:[number];move:[number,number];add:[];remove:[number]}>()
function editCurve(i:number,event:Event){const raw=Number((event.target as HTMLInputElement).value);if(Number.isFinite(raw))props.config.curve[i]=Math.max(i%2?-1:0,Math.min(i%2?2:1,raw))}
function editFrame(frame:Frame,key:'x'|'y'|'scale'|'opacity',event:Event){const value=Number((event.target as HTMLInputElement).value);if(!Number.isFinite(value))return;const bounds=key==='scale'?[.1,3]:key==='opacity'?[0,1]:[-300,300];frame[key]=Math.max(bounds[0],Math.min(bounds[1],value))}
const addFrame=()=>emit('add')
const selectFrame=(offset:number)=>emit('select',offset)
const moveFrame=(from:number,to:number)=>emit('move',from,to)
</script>
<template>
   <label>时长 <output>{{config.duration}} ms</output><input v-model.number="config.duration" type="range" min="0" max="3000" step="10"></label>
   <label v-if="['slide','spring','stagger'].includes(config.effect)">位移 <output>{{config.distance}} px</output><input v-model.number="config.distance" type="range" min="0" max="240"></label>
   <label v-if="config.effect==='spring'&&!config.physics">回弹 <output>{{config.bounce.toFixed(2)}}</output><input v-model.number="config.bounce" type="range" min="0" max=".6" step=".01"></label>
   <label v-if="config.effect==='stagger'">级联间隔 <output>{{config.stagger}} ms</output><input v-model.number="config.stagger" type="range" min="0" max="200"></label>
   <template v-if="['spring','shared','flip','drag'].includes(config.effect)"><label class="ws-asset-check"><input type="checkbox" :checked="!!config.physics" @change="config.physics=($event.target as HTMLInputElement).checked?{mass:1,stiffness:180,damping:18,velocity:0}:undefined">物理弹簧模式</label><template v-if="config.physics"><label v-for="key in (config.effect==='drag'?(['mass','stiffness','damping'] as const):(['mass','stiffness','damping','velocity'] as const))" :key="key">{{key}} <output>{{config.physics[key]}}</output><input v-model.number="config.physics[key]" type="range" :min="key==='mass' ? .1 : key==='velocity' ? -2000 : key==='stiffness' ? 10 : 1" :max="key==='mass'?5:key==='stiffness'?800:key==='damping'?80:2000" :step="key==='mass' ? .1 : 1"></label></template></template>
   <template v-if="config.effect!=='drag'&&!config.physics"><h3>缓动曲线</h3><CurveEditor :easing-key="config.effect==='spring'?'spring':'custom'" :bezier="config.curve" :bounce="config.bounce" :duration="config.duration" :css="easingOf(config)" @drag="config.curve=$event"/>
   <div v-if="config.effect!=='spring'" class="ws-curve-input"><label v-for="(_,i) in config.curve" :key="i">{{['X1','Y1','X2','Y2'][i]}}<input type="number" step=".05" :min="i%2?-1:0" :max="i%2?2:1" :value="config.curve[i]" @change="editCurve(i,$event)"></label></div><small>{{easingOf(config)}}</small></template>
   <template v-if="isTimeline(config.effect)&&config.effect!=='spring'"><h3>关键帧</h3><label>插入位置<input v-model.number="config.middle" type="range" min=".05" max=".95" step=".05"></label><button @click="addFrame">添加关键帧 {{Math.round(config.middle*100)}}%</button><div v-for="(frame,i) in config.frames" :key="i" class="ws-keyframe" :class="{selected:selected===frame.offset}"><button class="ws-frame-select" @click="selectFrame(frame.offset)">定位 {{Math.round(frame.offset*100)}}%</button><label>位置 %<input type="number" min="1" max="99" :value="Math.round(frame.offset*100)" @change="moveFrame(frame.offset,Number(($event.target as HTMLInputElement).value)/100)"></label><label v-for="key in (['x','y','scale','opacity'] as const)" :key="key">{{key}}<input type="number" :step="key==='scale'||key==='opacity' ? .1 : 1" :value="frame[key]" @change="editFrame(frame,key,$event)"></label><button @click="emit('remove',i)">删除</button></div></template>

</template>
