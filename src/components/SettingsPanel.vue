<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import {
  ArrowLeft, ArrowLeftRight, Battery, BatteryCharging, ChevronRight, FlaskConical, Gauge, Heart, Info,
  MessageCircle, Moon, MousePointerClick, Play, Reply, RotateCcw, Send, Settings, Sun, Trash2, Zap
} from 'lucide-vue-next'
import { vRipple } from '../ripple'
import { bezierFor, easingMeta, easingOrder, type Bezier, type EasingKey } from '../motion'
import {
  animationList, battery, blockedReason, durationFor, easing, motionDisabled, powerSavingActive, resetSettings,
  resolvedTheme, settings, system, timeScales, type AnimationKey, type AnimationMeta, type DemoKey, type SettingsTab, type ThemeMode
} from '../settings'
import ToggleRow from './ToggleRow.vue'
import RadioRow from './RadioRow.vue'
import RangeSlider from './RangeSlider.vue'
import CurveEditor from './CurveEditor.vue'
import CompareLanes from './CompareLanes.vue'

const props = defineProps<{ entry?: SettingsTab }>()
const emit = defineEmits<{
  close: []
  demo: [key: DemoKey]
  theme: [mode: ThemeMode, x: number, y: number]
  about: []
  toast: [text: string]
}>()

const stack = ref<SettingsTab[]>(props.entry && props.entry !== 'main' ? ['main', props.entry] : ['main'])
const dir = ref<'push' | 'pop'>('push')
const current = computed<SettingsTab>(() => stack.value[stack.value.length - 1] ?? 'main')
const titles: Record<SettingsTab, string> = { main: '设置', general: '通用设置', animations: '动画与省电', lab: '动效实验室' }

function go(tab: SettingsTab) {
  if (current.value === tab) return
  if (tab === 'main') { back(); return }
  dir.value = 'push'
  stack.value = ['main', tab]
}
function back() {
  if (stack.value.length > 1) {
    dir.value = 'pop'
    stack.value = stack.value.slice(0, -1)
  } else {
    emit('close')
  }
}
defineExpose({ go, back, current })

/* theme changes carry the pointer position so the reveal starts under the finger */
let pointer = { x: innerWidth / 2, y: 80 }
function rememberPointer(e: PointerEvent) { pointer = { x: e.clientX, y: e.clientY } }
function chooseTheme(mode: ThemeMode) { emit('theme', mode, pointer.x, pointer.y) }
function toggleTheme(e: MouseEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  emit('theme', resolvedTheme.value === 'light' ? 'dark' : 'light', r.left + r.width / 2, r.top + r.height / 2)
}

const curveBezier = computed<Bezier>(() => bezierFor(settings.easing, settings.customBezier))
function onCurveDrag(value: Bezier) {
  settings.customBezier = value
  settings.easing = 'custom'
}
function chooseEasing(key: EasingKey) { settings.easing = key }

const previewDuration = computed(() => motionDisabled.value ? 0 : Math.round(settings.duration * settings.timeScale * (powerSavingActive.value ? 0.75 : 1)))
const animSummary = computed(() => {
  if (!settings.interfaceAnimations) return '已关闭'
  if (motionDisabled.value) return '跟随系统 · 已减少'
  return `${easingMeta[settings.easing].label} · ${settings.duration} ms${powerSavingActive.value ? ' · 省电中' : ''}`
})
const breakdown: [AnimationKey, string][] = [['send', '发送'], ['chat', '切换'], ['sidebar', '推入'], ['menu', '菜单'], ['reaction', '回应']]
const batteryText = computed(() => battery.supported
  ? `当前电量 ${Math.round(battery.level * 100)}%${battery.charging ? ' · 充电中（不会触发）' : ''}`
  : '此浏览器不提供电池信息，按“已接通电源”处理')

const demos: { key: DemoKey; icon: Component; title: string; desc: string; anim?: AnimationKey }[] = [
  { key: 'send', icon: Send, title: '消息飞入', desc: '输入框 → 气泡', anim: 'send' },
  { key: 'incoming', icon: MessageCircle, title: '收到消息', desc: '正在输入 → 入场', anim: 'incoming' },
  { key: 'chat', icon: ArrowLeftRight, title: '聊天切换', desc: '横向转场', anim: 'chat' },
  { key: 'sidebar', icon: Settings, title: '页面推入', desc: '设置子页面', anim: 'sidebar' },
  { key: 'menu', icon: MousePointerClick, title: '上下文菜单', desc: '锚点缩放展开', anim: 'menu' },
  { key: 'reaction', icon: Heart, title: '表情回应', desc: '飞入 + 粒子', anim: 'reaction' },
  { key: 'swipe', icon: Reply, title: '滑动回复', desc: '跟手 + 回弹', anim: 'sidebar' },
  { key: 'delete', icon: Trash2, title: '删除消息', desc: '高度收起', anim: 'incoming' },
  { key: 'theme', icon: Moon, title: '夜间模式', desc: '圆形扩散', anim: 'themeReveal' },
  { key: 'stress', icon: Gauge, title: '压力测试', desc: '追加 500 条消息' }
]
const msLabel = (key?: AnimationKey) => {
  if (!key) return ''
  const ms = durationFor(key)
  return ms ? ms + ' ms' : '已关闭'
}

let sidebarDemo: ReturnType<typeof setTimeout> | undefined
function runDemo(key: DemoKey) {
  if (key === 'sidebar') {
    go('general')
    if (sidebarDemo) clearTimeout(sidebarDemo)
    sidebarDemo = setTimeout(() => go('lab'), Math.max(900, durationFor('sidebar') + 700))
    return
  }
  emit('demo', key)
}

function demoFor(item: AnimationMeta) {
  if (item.demo) runDemo(item.demo)
}

function reset() {
  resetSettings()
  emit('toast', '已恢复默认设置')
}
</script>

<template>
  <section class="settings" aria-label="设置面板" @pointerdown.capture="rememberPointer">
    <div class="slider">
      <Transition :name="'tab-' + dir">
        <div :key="current" class="tab settings-tab" :data-tab="current">
          <header class="tab-header">
            <button v-ripple class="icon-btn" :aria-label="current === 'main' ? '关闭设置' : '返回'" @click="back"><ArrowLeft :size="24" /></button>
            <h2>{{ titles[current] }}</h2>
            <button v-if="current === 'main'" v-ripple class="icon-btn" :aria-label="resolvedTheme === 'light' ? '开启夜间模式' : '关闭夜间模式'" @click="toggleTheme">
              <Transition name="icon-swap" mode="out-in">
                <Moon v-if="resolvedTheme === 'light'" key="moon" :size="22" />
                <Sun v-else key="sun" :size="22" />
              </Transition>
            </button>
          </header>

          <div class="tab-scroll">
            <!-- ============ main ============ -->
            <template v-if="current === 'main'">
              <div class="profile">
                <span class="avatar profile-avatar" style="--avatar:#3390ec">ML</span>
                <strong>Motion Lab</strong>
                <small>在线 · Telegram 风格动效实验室</small>
              </div>
              <div class="settings-group">
                <button v-ripple class="row nav-row" @click="go('general')">
                  <Settings class="row-icon" :size="22" />
                  <span class="row-text"><span class="row-title">通用设置</span><small>文字大小、气泡、主题、快捷键</small></span>
                  <ChevronRight class="row-chevron" :size="18" />
                </button>
                <button v-ripple class="row nav-row" @click="go('animations')">
                  <Zap class="row-icon" :size="22" />
                  <span class="row-text"><span class="row-title">动画与省电</span><small>{{ animSummary }}</small></span>
                  <ChevronRight class="row-chevron" :size="18" />
                </button>
                <button v-ripple class="row nav-row" @click="go('lab')">
                  <FlaskConical class="row-icon" :size="22" />
                  <span class="row-text"><span class="row-title">动效实验室</span><small>交互演示、慢放、曲线对比</small></span>
                  <ChevronRight class="row-chevron" :size="18" />
                </button>
              </div>
              <div class="settings-group">
                <button v-ripple class="row nav-row" @click="emit('about')">
                  <Info class="row-icon" :size="22" />
                  <span class="row-text"><span class="row-title">关于 Motion Lab</span><small>非官方 · 仅用于研究动效</small></span>
                </button>
                <button v-ripple class="row nav-row danger" @click="reset">
                  <RotateCcw class="row-icon" :size="22" />
                  <span class="row-text"><span class="row-title">恢复默认设置</span></span>
                </button>
              </div>
            </template>

            <!-- ============ general ============ -->
            <template v-else-if="current === 'general'">
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

            <!-- ============ animations & power saving ============ -->
            <template v-else-if="current === 'animations'">
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
                  <div v-if="powerSavingActive" class="collapse-body"><div class="collapse-inner"><p class="banner">省电模式已生效：粒子、渐变壁纸、主题扩散与涟漪已停用，其余动画缩短 25%。</p></div></div>
                </Transition>
              </div>

              <div class="settings-group">
                <h3 class="group-caption">动画</h3>
                <ToggleRow v-model="settings.interfaceAnimations" label="界面动画" desc="关闭后所有过渡立即完成" />
                <ToggleRow v-model="settings.respectSystemMotion" label="跟随系统「减少动态效果」" :desc="`系统当前：${system.reducedMotion ? '已开启（动画将被关闭）' : '未开启'}`" />
              </div>

              <div class="settings-group" :class="{ dimmed: motionDisabled }">
                <h3 class="group-caption">缓动曲线 <b>{{ easingMeta[settings.easing].label }}</b></h3>
                <div class="chips" role="radiogroup" aria-label="缓动曲线">
                  <button v-for="key in easingOrder" :key="key" v-ripple class="chip" role="radio" :aria-checked="settings.easing === key" :class="{ chosen: settings.easing === key }" @click="chooseEasing(key)">{{ easingMeta[key].label }}</button>
                </div>
                <CurveEditor :easing-key="settings.easing" :bezier="curveBezier" :bounce="settings.springBounce" :duration="previewDuration" :css="easing" @drag="onCurveDrag" />
                <p class="group-hint">{{ easingMeta[settings.easing].description }}</p>
                <Transition name="collapse">
                  <div v-if="settings.easing === 'spring'" class="collapse-body"><div class="collapse-inner">
                    <h3 class="group-caption">回弹幅度 <b>{{ Math.round(settings.springBounce * 100) }}%</b></h3>
                    <div class="slider-row"><RangeSlider v-model="settings.springBounce" :min="0" :max="0.6" :step="0.05" label="回弹幅度" /></div>
                  </div></div>
                </Transition>
              </div>

              <div class="settings-group" :class="{ dimmed: motionDisabled }">
                <h3 class="group-caption">基础时长 <b>{{ settings.duration }} ms</b></h3>
                <div class="slider-row"><RangeSlider id="duration" v-model="settings.duration" :min="120" :max="650" :step="10" label="动画时长" /></div>
                <div class="range-labels"><span>120 ms · 快速</span><span>650 ms · 舒缓</span></div>
                <div class="breakdown">
                  <span v-for="[key, name] in breakdown" :key="key" :class="{ off: !durationFor(key) }">{{ name }} <b>{{ msLabel(key) }}</b></span>
                </div>
              </div>

              <div class="settings-group">
                <h3 class="group-caption">动画类别</h3>
                <ToggleRow
                  v-for="item in animationList"
                  :key="item.key"
                  v-model="settings.animations[item.key]"
                  :label="item.label"
                  :desc="item.desc"
                  :badge="item.heavy ? '省电' : undefined"
                  :disabled="!!blockedReason(item.key) && blockedReason(item.key) !== '省电模式中已停用'"
                  :note="settings.animations[item.key] ? blockedReason(item.key) : ''"
                >
                  <template v-if="item.demo" #extra>
                    <button class="demo-play" type="button" :aria-label="'演示' + item.label" :title="'演示' + item.label" @click.prevent.stop="demoFor(item)"><Play :size="14" /></button>
                  </template>
                </ToggleRow>
              </div>
            </template>

            <!-- ============ lab ============ -->
            <template v-else>
              <div class="settings-group">
                <h3 class="group-caption">交互演示 <small>点击后在右侧聊天中实时播放</small></h3>
                <div class="demo-grid">
                  <button v-for="d in demos" :key="d.key" v-ripple class="demo-tile" @click="runDemo(d.key)">
                    <span class="demo-icon"><component :is="d.icon" :size="20" /></span>
                    <strong>{{ d.title }}</strong>
                    <small>{{ d.desc }}</small>
                    <em v-if="d.anim" :class="{ off: !durationFor(d.anim) }">{{ msLabel(d.anim) }}</em>
                  </button>
                </div>
              </div>
              <div class="settings-group">
                <h3 class="group-caption">慢放 <b>{{ settings.timeScale }}×</b></h3>
                <div class="segmented" role="radiogroup" aria-label="慢放倍数">
                  <button v-for="s in timeScales" :key="s" role="radio" :aria-checked="settings.timeScale === s" :class="{ chosen: settings.timeScale === s }" @click="settings.timeScale = s">{{ s === 1 ? '正常' : s + '×' }}</button>
                </div>
                <p class="group-hint">放慢所有动画以便逐帧观察曲线与编排，类似系统开发者选项中的“动画时长缩放”。</p>
              </div>
              <div class="settings-group">
                <h3 class="group-caption">曲线对比 <small>同一时长下的五种缓动</small></h3>
                <CompareLanes :duration="previewDuration" :bounce="settings.springBounce" :custom="settings.customBezier" :active="settings.easing" />
              </div>
              <div class="settings-group">
                <h3 class="group-caption">调试</h3>
                <ToggleRow v-model="settings.showFps" label="显示帧率" desc="左下角实时 FPS 与最长帧耗时" />
                <ToggleRow v-model="settings.autoReply" label="模拟对方回复" desc="发送后显示“正在输入…”并自动回复" />
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </div>
  </section>
</template>
