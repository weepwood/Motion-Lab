<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Play } from 'lucide-vue-next'
import { clamp, easingValue, springValue, type Bezier, type EasingKey } from '../motion'

const props = defineProps<{ easingKey: EasingKey; bezier: Bezier; bounce: number; duration: number; css: string }>()
const emit = defineEmits<{ drag: [value: Bezier] }>()

const W = 300
const H = 180
const X = (t: number) => 24 + t * 252
const Y = (v: number) => 148 - v * 104

const svgEl = ref<SVGSVGElement | null>(null)
const progress = ref(1)
const value = ref(1)
const dragging = ref<0 | 1 | null>(null)
let raf = 0
let autoTimer: ReturnType<typeof setTimeout> | undefined

const isSpring = computed(() => props.easingKey === 'spring')
const path = computed(() => {
  if (isSpring.value) {
    const pts: string[] = []
    for (let i = 0; i <= 90; i++) {
      const t = i / 90
      pts.push(`${i ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(springValue(t, props.bounce)).toFixed(1)}`)
    }
    return pts.join(' ')
  }
  const [x1, y1, x2, y2] = props.bezier
  return `M${X(0)} ${Y(0)} C${X(x1)} ${Y(y1)}, ${X(x2)} ${Y(y2)}, ${X(1)} ${Y(1)}`
})
const handles = computed(() => {
  const [x1, y1, x2, y2] = props.bezier
  return [{ x: X(x1), y: Y(y1), ox: X(0), oy: Y(0) }, { x: X(x2), y: Y(y2), ox: X(1), oy: Y(1) }]
})
const label = computed(() => isSpring.value
  ? `spring(bounce: ${props.bounce.toFixed(2)})`
  : `cubic-bezier(${props.bezier.map(n => Number(n.toFixed(2))).join(', ')})`)

function play() {
  cancelAnimationFrame(raf)
  const d = props.duration
  if (d <= 0) { progress.value = 1; value.value = 1; return }
  progress.value = 0
  value.value = 0
  let start = 0
  const frame = (now: number) => {
    if (!start) start = now
    const p = clamp((now - start) / d, 0, 1)
    progress.value = p
    value.value = easingValue(props.easingKey, props.bezier, props.bounce, p)
    if (p < 1) raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
}

watch(() => [props.easingKey, props.bounce, props.duration, ...props.bezier], () => {
  if (dragging.value !== null) return
  if (autoTimer) clearTimeout(autoTimer)
  autoTimer = setTimeout(play, 220)
})

function toCurve(e: PointerEvent): { t: number; v: number } | null {
  const rect = svgEl.value?.getBoundingClientRect()
  if (!rect || !rect.width) return null
  const vx = ((e.clientX - rect.left) / rect.width) * W
  const vy = ((e.clientY - rect.top) / rect.height) * H
  return { t: clamp((vx - 24) / 252, 0, 1), v: clamp((148 - vy) / 104, -0.5, 1.5) }
}
function startDrag(e: PointerEvent, index: 0 | 1) {
  if (isSpring.value) return
  dragging.value = index
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
}
function moveDrag(e: PointerEvent) {
  if (dragging.value === null) return
  const pt = toCurve(e)
  if (!pt) return
  const next = [...props.bezier] as Bezier
  const r = (n: number) => Math.round(n * 100) / 100
  if (dragging.value === 0) { next[0] = r(pt.t); next[1] = r(pt.v) }
  else { next[2] = r(pt.t); next[3] = r(pt.v) }
  emit('drag', next)
}
function endDrag() {
  if (dragging.value === null) return
  dragging.value = null
  play()
}

onMounted(() => { autoTimer = setTimeout(play, 300) })
onBeforeUnmount(() => { cancelAnimationFrame(raf); if (autoTimer) clearTimeout(autoTimer) })
defineExpose({ play })
</script>

<template>
  <div class="curve-editor" :class="{ spring: isSpring, off: duration <= 0 }">
    <svg ref="svgEl" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="'缓动曲线 ' + label" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag">
      <line class="grid" :x1="X(0)" :y1="Y(0)" :x2="X(1)" :y2="Y(0)" />
      <line class="grid" :x1="X(0)" :y1="Y(1)" :x2="X(1)" :y2="Y(1)" />
      <line class="diagonal" :x1="X(0)" :y1="Y(0)" :x2="X(1)" :y2="Y(1)" />
      <line class="cursor" :x1="X(progress)" :y1="Y(-0.2)" :x2="X(progress)" :y2="Y(1.35)" />
      <path class="curve" :d="path" />
      <template v-if="!isSpring">
        <g v-for="(h, i) in handles" :key="i" class="handle" :class="{ active: dragging === i }">
          <line :x1="h.ox" :y1="h.oy" :x2="h.x" :y2="h.y" />
          <circle class="handle-hit" :cx="h.x" :cy="h.y" r="16" @pointerdown.prevent="startDrag($event, i === 0 ? 0 : 1)" />
          <circle class="handle-dot" :cx="h.x" :cy="h.y" r="6" />
        </g>
      </template>
      <circle class="progress-dot" :cx="X(progress)" :cy="Y(value)" r="5" />
      <text class="axis" :x="X(0)" :y="H - 8">0</text>
      <text class="axis" :x="X(1) - 30" :y="H - 8">{{ duration }} ms</text>
    </svg>
    <div class="curve-track" aria-hidden="true">
      <span class="track-ball linear" :style="{ left: `calc(${progress} * (100% - 18px))` }"></span>
      <span class="track-ball" :style="{ left: `calc(${value} * (100% - 18px))` }"></span>
    </div>
    <div class="curve-footer">
      <code :title="css">{{ label }}</code>
      <button class="mini-btn" type="button" :disabled="duration <= 0" @click="play"><Play :size="14" /> 预览</button>
    </div>
  </div>
</template>
