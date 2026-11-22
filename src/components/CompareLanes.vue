<script setup lang="ts">
import { Play } from 'lucide-vue-next'
import { easingCss, easingMeta, easingOrder, play, type Bezier, type EasingKey } from '../motion'

const props = defineProps<{ duration: number; bounce: number; custom: Bezier; active: EasingKey }>()
// Plain array on purpose: lane elements are not render state.
const lanes: HTMLElement[] = []
let running: Animation[] = []

function setLane(el: unknown, i: number) {
  if (el instanceof HTMLElement) lanes[i] = el
}
function run() {
  running.forEach(a => a.cancel())
  running = []
  easingOrder.forEach((key, i) => {
    const lane = lanes[i]
    const ball = lane?.querySelector<HTMLElement>('.lane-ball')
    if (!lane || !ball) return
    const distance = lane.clientWidth - ball.offsetWidth
    const anim = play(ball, [
      { transform: 'translate3d(0,0,0)' },
      { transform: `translate3d(${distance}px,0,0)` }
    ], props.duration, easingCss(key, props.custom, props.bounce), { fill: 'forwards' })
    if (anim) running.push(anim)
  })
}
defineExpose({ run })
</script>

<template>
  <div class="compare">
    <div v-for="(key, i) in easingOrder" :key="key" class="lane-row" :class="{ active: key === active }">
      <span class="lane-name">{{ easingMeta[key].label }}</span>
      <div :ref="el => setLane(el, i)" class="lane"><span class="lane-ball"></span></div>
    </div>
    <button class="mini-btn compare-run" type="button" :disabled="duration <= 0" @click="run"><Play :size="14" /> 同时播放对比</button>
  </div>
</template>
