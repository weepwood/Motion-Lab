<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import type { Asset } from './assets'
import type { Config } from './model'
const props=defineProps<{assets:Asset[];active:string}>()
const emit=defineEmits<{save:[string,boolean];load:[string,number];compare:[Config];rename:[string,string];archive:[string[],boolean];purge:[string[]];import:[string];export:[]}>()
const name=ref(''),io=ref(''),query=ref(''),trash=ref(false),selected=ref<string[]>([]),confirmPurge=ref(false)
const visible=computed(()=>props.assets.filter(a=>Boolean(a.deletedAt)===trash.value&&a.name.toLowerCase().includes(query.value.toLowerCase())))
watch([trash,query],()=>{selected.value=[];confirmPurge.value=false})
watch(()=>props.assets,()=>{selected.value=selected.value.filter(id=>visible.value.some(a=>a.id===id))},{deep:true})
watch(()=>props.active,id=>{const a=props.assets.find(x=>x.id===id);if(a)name.value=a.name})
function toggle(id:string){confirmPurge.value=false;selected.value=selected.value.includes(id)?selected.value.filter(x=>x!==id):[...selected.value,id]}
function archive(){emit('archive',[...selected.value],trash.value);selected.value=[]}
function purge(){if(!confirmPurge.value){confirmPurge.value=true;return}emit('purge',[...selected.value]);selected.value=[];confirmPurge.value=false}
</script>
<template>
<h3>本地预设与版本</h3>
<input v-model="name" aria-label="预设名称" placeholder="命名预设">
<div class="ws-toolbar"><button @click="emit('save',name,false)">保存新预设</button><button :disabled="!active" @click="emit('save',name,true)">保存新版本</button><button :disabled="!active||!name.trim()" @click="emit('rename',active,name)">重命名</button></div>
<div class="ws-toolbar"><button :aria-pressed="!trash" @click="trash=false">预设</button><button :aria-pressed="trash" @click="trash=true">回收站</button></div>
<input v-model="query" aria-label="搜索预设" placeholder="搜索预设">
<div class="ws-toolbar"><button @click="selected=visible.map(a=>a.id)">全选</button><button :disabled="!selected.length" @click="archive">{{trash?'恢复所选':'删除所选'}}</button><button v-if="trash" :disabled="!selected.length" @click="purge">{{confirmPurge?'确认永久删除':'永久删除'}}</button></div>
<div v-for="a in visible" :key="a.id" class="ws-asset"><label class="ws-asset-check"><input type="checkbox" :checked="selected.includes(a.id)" :aria-label="'选择 '+a.name" @change="toggle(a.id)"><b>{{a.name}}</b></label><template v-if="!trash"><div v-for="(rev,i) in a.versions" :key="i" class="ws-version"><button @click="emit('load',a.id,i)">版本 {{a.versions.length-i}} · {{rev.at.slice(0,10)}}</button><button :aria-label="'对比 '+a.name+' 版本 '+(a.versions.length-i)" @click="emit('compare',rev.config)">B</button></div></template></div>
<textarea v-model="io" aria-label="资产 JSON" placeholder="粘贴资产 JSON（合并导入）"></textarea><div class="ws-toolbar"><button @click="emit('import',io)">导入</button><button @click="emit('export')">导出资产</button></div>
</template>
