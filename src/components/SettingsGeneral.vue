<script setup lang="ts">
import { settings, system, type ThemeMode } from '../settings'
import RadioRow from './RadioRow.vue'
import RangeSlider from './RangeSlider.vue'
const emit=defineEmits<{theme:[ThemeMode]}>()
const chooseTheme=(mode:ThemeMode)=>emit('theme',mode)
</script>
<template>

              <div class="settings-group">
                <h3 class="group-caption">消息文字大小 <b>{{ settings.textSize }}</b></h3>
                <div class="slider-row"><span class="a-small">A</span><RangeSlider v-model="settings.textSize" :min="12" :max="22" label="消息文字大小" /><span class="a-big">A</span></div>
                <h3 class="group-caption">气泡圆角 <b>{{ settings.bubbleRadius }}</b></h3>
                <div class="slider-row"><span class="corner-icon sharp"></span><RangeSlider v-model="settings.bubbleRadius" :min="4" :max="20" label="气泡圆角" /><span class="corner-icon round"></span></div>
                <div class="text-preview" aria-hidden="true">
                  <div class="message-row incoming group-start group-end"><div class="bubble has-tail"><span class="bubble-text">早上好！试着拖动上面的滑块 👋</span><span class="meta-spacer"></span><span class="bubble-meta">09:41</span><svg class="bubble-tail" viewBox="0 0 11 20"><path d="M11 0v20H1.6c-1.4 0-2-1.6-1-2.5C5.4 13.6 9.9 8.6 11 0Z" /></svg></div></div>
                  <div class="message-row mine group-start group-end"><div class="bubble has-tail"><span class="bubble-text">文字和圆角会实时生效 ✨</span><span class="meta-spacer"></span><span class="bubble-meta">09:42</span><svg class="bubble-tail" viewBox="0 0 11 20"><path d="M11 0v20H1.6c-1.4 0-2-1.6-1-2.5C5.4 13.6 9.9 8.6 11 0Z" /></svg></div></div>
                </div>
              </div>
              <div class="settings-group">
                <h3 class="group-caption">主题</h3>
                <RadioRow :model-value="settings.theme" value="light" name="theme" label="日间" @update:model-value="chooseTheme" />
                <RadioRow :model-value="settings.theme" value="dark" name="theme" label="夜间" @update:model-value="chooseTheme" />
                <RadioRow :model-value="settings.theme" value="system" name="theme" label="跟随系统" :desc="`系统当前为${system.dark ? '深色' : '浅色'}`" @update:model-value="chooseTheme" />
              </div>
              <div class="settings-group">
                <h3 class="group-caption">键盘</h3>
                <RadioRow v-model="settings.sendKey" value="enter" name="send-key" label="按 Enter 发送" desc="Shift + Enter 换行" />
                <RadioRow v-model="settings.sendKey" value="ctrl-enter" name="send-key" label="按 Ctrl + Enter 发送" desc="Enter 换行" />
              </div>
              <div class="settings-group">
                <h3 class="group-caption">时间格式</h3>
                <RadioRow v-model="settings.timeFormat" value="24h" name="time-format" label="24 小时制" desc="14:30" />
                <RadioRow v-model="settings.timeFormat" value="12h" name="time-format" label="12 小时制" desc="下午2:30" />
              </div>
</template>
