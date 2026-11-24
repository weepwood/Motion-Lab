<script setup lang="ts">
import {computed} from 'vue'
import {Battery,BatteryCharging} from 'lucide-vue-next'
import {settings,battery,powerSavingActive,effectiveLevel,system} from '../settings'
import RadioRow from './RadioRow.vue'
import RangeSlider from './RangeSlider.vue'
import ToggleRow from './ToggleRow.vue'
const batteryText = computed(() => battery.supported
  ? `当前电量 ${Math.round(battery.level * 100)}%${battery.charging ? ' · 充电中（不会触发）' : ''}`
  : '此浏览器不提供电池信息，按“已接通电源”处理')

/* ---- animation levels (tweb liteMode 0/1/2) ---- */
const levels: { value: 0 | 1 | 2; label: string; desc: string }[] = [
  { value: 0, label: '关闭', desc: '所有过渡立即完成（Telegram 动画等级 0）' },
  { value: 1, label: '降级', desc: '位移瞬跳，保留淡入淡出与颜色过渡（等级 1）' },
  { value: 2, label: '完整', desc: '完整动画（等级 2）' }
]
const levelHint = computed(() => {
  const env: string[] = []
  if (system.reducedMotion && settings.respectSystemMotion) env.push('系统减动效强制 0 级')
  if (powerSavingActive.value) env.push('省电中最高 1 级')
  return `当前生效 ${effectiveLevel.value} 级${env.length ? '（' + env.join('，') + '）' : ''}`
})


</script>
<template>
              <div class="settings-group">
                <h3 class="group-caption">省电模式</h3>
                <RadioRow v-model="settings.powerSaving" value="off" name="power" label="关闭" />
                <RadioRow v-model="settings.powerSaving" value="battery" name="power" label="电量低时自动开启" :desc="`电量低于 ${settings.batteryThreshold}% 且未充电时`" />
                <RadioRow v-model="settings.powerSaving" value="always" name="power" label="始终开启" />
                <Transition name="collapse">
                  <div v-if="settings.powerSaving === 'battery'" class="collapse-body"><div class="collapse-inner">
                    <div class="slider-row"><BatteryCharging v-if="battery.charging" :size="18" /><Battery v-else :size="18" /><RangeSlider v-model="settings.batteryThreshold" :min="5" :max="50" label="省电电量阈值" /><b class="slider-value">{{ settings.batteryThreshold }}%</b></div>
                    <p class="group-hint">{{ batteryText }}</p>
                  </div></div>
                </Transition>
                <Transition name="collapse">
                  <div v-if="powerSavingActive" class="collapse-body"><div class="collapse-inner"><p class="banner">省电模式已生效：粒子、渐变壁纸、主题扩散与涟漪已停用，其余动画缩短 25%，降级为「仅淡入淡出」模式。</p></div></div>
                </Transition>
              </div>

              <div class="settings-group">
                <h3 class="group-caption">动画等级</h3>
                <div class="segmented" role="radiogroup" aria-label="动画等级">
                  <button v-for="lv in levels" :key="lv.value" role="radio" :aria-checked="settings.animationLevel === lv.value" :class="{ chosen: settings.animationLevel === lv.value }" @click="settings.animationLevel = lv.value">{{ lv.label }}</button>
                </div>
                <p class="group-hint">{{ levels.find(l => l.value === settings.animationLevel)?.desc }}。{{ levelHint }}</p>
                <ToggleRow v-model="settings.respectSystemMotion" label="跟随系统「减少动态效果」" :desc="`系统当前：${system.reducedMotion ? '已开启（动画将被关闭）' : '未开启'}`" />
              </div>


</template>
