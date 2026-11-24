<script setup lang="ts">
import { computed,ref } from 'vue'
import { Search, Star, ArrowUpRight } from 'lucide-vue-next'
import { catalog, styles, type Effect } from './model'
const props=defineProps<{active:Effect;favorites:Effect[]}>()
const emit=defineEmits<{choose:[Effect];favorite:[Effect];preset:[number]}>()
const query=ref(''),category=ref('全部')
const categories=['全部','转场','微交互','布局','手势','收藏']
const filtered=computed(()=>catalog.filter(x=>(category.value==='全部'||(category.value==='收藏'?props.favorites.includes(x.id):x.category===category.value))&&(x.title+' '+x.desc+' '+x.id).toLowerCase().includes(query.value.trim().toLowerCase())))
</script>
<template>
<aside class="ws-nav">
  <div class="ws-section-label"><h2>动效资源</h2><span>{{filtered.length}} / {{catalog.length}}</span></div>
  <div class="ws-search"><Search :size="16"/><input v-model="query" aria-label="搜索动效" placeholder="搜索名称或类型…"></div>
  <div class="ws-categories"><button v-for="c in categories" :key="c" :aria-pressed="category===c" @click="category=c">{{c}}</button></div>
  <div class="ws-resource-list">
    <div v-for="item in filtered" :key="item.id" class="ws-entry" :class="{active:active===item.id}">
      <button :aria-label="item.title" :aria-pressed="active===item.id" @click="emit('choose',item.id)"><b>{{item.title}}</b><small>{{item.desc}}</small></button>
      <button :aria-label="'收藏 '+item.title" :aria-pressed="favorites.includes(item.id)" @click="emit('favorite',item.id)"><Star :size="15" :fill="favorites.includes(item.id)?'currentColor':'none'"/></button>
    </div>
    <p v-if="!filtered.length" class="ws-hint">暂无匹配动效</p>
  </div>
  <h2 class="ws-subtitle">研究预设</h2>
  <div v-for="(s,i) in styles" :key="s.name" class="ws-study"><button @click="emit('preset',i)">{{s.name}}</button><a :href="s.url" target="_blank" rel="noopener">{{s.source}} <ArrowUpRight :size="12"/></a><small>独立近似，非官方实测值</small></div>
</aside>
</template>
