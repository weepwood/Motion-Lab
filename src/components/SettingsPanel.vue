<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type Component } from 'vue'
import {
  ArrowLeft, ArrowLeftRight, Battery, BatteryCharging, ChevronRight, Code2, FlaskConical, Gauge, Heart, Info,
  MessageCircle, Moon, MousePointerClick, Play, Reply, RotateCcw, Send, Settings, Sun, Trash2, Zap
} from 'lucide-vue-next'
import { vRipple } from '../ripple'
import { bezierFor, easingMeta, easingOrder, type Bezier, type EasingKey } from '../motion'
import {
  animationList, battery, blockedReason, defaultMechanics, durationFor, easing, effectiveLevel, motionDisabled,
  powerSavingActive, resetSettings, resolvedTheme, settings, system, timeScales,
  type AnimationKey, type AnimationMeta, type DemoKey, type SettingsTab, type ThemeMode
} from '../settings'
import { exportSettings, importSettings, motionPresets } from '../presets'
import SettingsGeneral from './SettingsGeneral.vue'
import SettingsMechanisms from './SettingsMechanisms.vue'
import SettingsPower from './SettingsPower.vue'
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
  export: []
}>()

const stack = ref<SettingsTab[]>(props.entry && props.entry !== 'main' ? ['main', props.entry] : ['main'])
const dir = ref<'push' | 'pop'>('push')
const current = computed<SettingsTab>(() => stack.value[stack.value.length - 1] ?? 'main')
const titles: Record<SettingsTab, string> = { main: '设置', general: '通用设置', animations: '动画与省电', lab: '动效实验室', export: 'AI 复刻导出' }

function go(tab: SettingsTab) {
  if(tab==='export'){emit('export');return}
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
  if (settings.animationLevel === 0) return '已关闭'
  if (motionDisabled.value) return '跟随系统 · 已减少'
  if (effectiveLevel.value === 1) return `降级模式 · ${easingMeta[settings.easing].label}`
  return `${easingMeta[settings.easing].label} · ${settings.duration} ms${powerSavingActive.value ? ' · 省电中' : ''}`
})
const breakdown: [AnimationKey, string][] = [['send', '发送'], ['chat', '切换'], ['sidebar', '推入'], ['menu', '菜单'], ['reaction', '回应']]
/* ---- per-category overrides (tier 2) ---- */
const overrideTarget = ref<AnimationKey>('send')
const targetMeta = computed(() => animationList.find(a => a.key === overrideTarget.value) as AnimationMeta)
const targetOverride = computed(() => settings.overrides[overrideTarget.value])
const targetCustomDuration = computed({
  get: () => targetOverride.value.duration !== null,
  set: (on: boolean) => {
    targetOverride.value.duration = on ? Math.round(settings.duration * (targetMeta.value.factor || 1)) : null
  }
})
const targetDurationModel = computed({
  get: () => targetOverride.value.duration ?? Math.round(settings.duration * targetMeta.value.factor),
  set: (v: number) => { targetOverride.value.duration = v }
})
const targetCustomEasing = computed({
  get: () => targetOverride.value.easing !== null,
  set: (on: boolean) => { targetOverride.value.easing = on ? settings.easing === 'custom' ? 'telegram' : settings.easing : null }
})

/* ---- presets & config file ---- */
const configText = ref('')
function applyPreset(index: number) {
  motionPresets[index]?.apply()
  emit('toast', `已应用预设「${motionPresets[index]?.label}」`)
}
function doExport() {
  configText.value = exportSettings()
  void navigator.clipboard?.writeText(configText.value)
    .then(() => emit('toast', '配置已导出并复制到剪贴板'), () => emit('toast', '已生成配置文本，请手动复制'))
}
function doImport() {
  const err = importSettings(configText.value)
  if (err) emit('toast', err)
  else { configText.value = ''; emit('toast', '配置导入成功') }
}

const demos: { key: DemoKey; icon: Component; title: string; desc: string; anim?: AnimationKey }[] = [
  { key: 'send', icon: Send, title: '消息飞入', desc: '输入框 → 气泡（双曲线弧线）', anim: 'send' },
  { key: 'incoming', icon: MessageCircle, title: '收到消息', desc: '正在输入 → 入场', anim: 'incoming' },
  { key: 'chat', icon: ArrowLeftRight, title: '聊天切换', desc: '横向转场', anim: 'chat' },
  { key: 'sidebar', icon: Settings, title: '页面推入', desc: '设置子页面 + 视差暗化', anim: 'sidebar' },
  { key: 'menu', icon: MousePointerClick, title: '上下文菜单', desc: '锚点缩放展开', anim: 'menu' },
  { key: 'reaction', icon: Heart, title: '表情回应', desc: '抛物线飞行 + 粒子', anim: 'reaction' },
  { key: 'swipe', icon: Reply, title: '滑动回复', desc: '阻尼跟手 + 回弹', anim: 'sidebar' },
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
onBeforeUnmount(() => clearTimeout(sidebarDemo))
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
                  <span class="row-text"><span class="row-title">动效实验室</span><small>机制参数、演示、慢放、曲线对比</small></span>
                  <ChevronRight class="row-chevron" :size="18" />
                </button>
                <button v-ripple class="row nav-row" @click="go('export')">
                  <Code2 class="row-icon" :size="22" />
                  <span class="row-text"><span class="row-title">AI 复刻导出</span><small>打开右侧工作区 · 实时参数与提示词</small></span>
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
            <SettingsGeneral v-else-if="current === 'general'" @theme="chooseTheme"/>

            <!-- ============ animations & power saving ============ -->
            <template v-else-if="current === 'animations'">
              <SettingsPower/>

              <div class="settings-group" :class="{ dimmed: motionDisabled }">
                <h3 class="group-caption">全局缓动曲线 <b>{{ easingMeta[settings.easing].label }}</b></h3>
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
                  :disabled="effectiveLevel === 0"
                  :note="settings.animations[item.key] ? blockedReason(item.key) : ''"
                >
                  <template v-if="item.demo" #extra>
                    <button class="demo-play" type="button" :aria-label="'演示' + item.label" :title="'演示' + item.label" @click.prevent.stop="demoFor(item)"><Play :size="14" /></button>
                  </template>
                </ToggleRow>
              </div>

              <div class="settings-group" :class="{ dimmed: motionDisabled }">
                <h3 class="group-caption">逐类时长与曲线 <small>覆盖某一类动画的时长与曲线</small></h3>
                <div class="chips" role="radiogroup" aria-label="选择动画类别">
                  <button v-for="item in animationList" :key="item.key" v-ripple class="chip" role="radio" :aria-checked="overrideTarget === item.key" :class="{ chosen: overrideTarget === item.key }" @click="overrideTarget = item.key">{{ item.label }}{{ settings.overrides[item.key].duration !== null || settings.overrides[item.key].easing !== null ? ' ·' + (settings.overrides[item.key].duration !== null ? ' 时长' : '') + (settings.overrides[item.key].easing !== null ? ' 曲线' : '') : '' }}</button>
                </div>
                <p class="group-hint">{{ targetMeta.desc }} · 当前 {{ msLabel(overrideTarget) }}</p>
                <ToggleRow v-model="targetCustomDuration" label="时长覆盖" :desc="`单独设定「${targetMeta.label}」的时长（默认跟随基础时长 ×系数）`" />
                <div class="slider-row" :class="{ off: !targetCustomDuration }">
                  <RangeSlider v-model="targetDurationModel" :min="80" :max="800" :step="10" :disabled="!targetCustomDuration" :label="targetMeta.label + ' 时长覆盖'" />
                  <b class="slider-value">{{ targetDurationModel }} ms</b>
                </div>
                <ToggleRow v-model="targetCustomEasing" label="曲线覆盖" desc="单独选择这一类动画的缓动曲线；自定义曲线在上方「全局缓动曲线」里编辑" />
                <div v-if="targetCustomEasing" class="chips" role="radiogroup" :aria-label="targetMeta.label + ' 曲线'">
                  <button v-for="key in easingOrder" :key="key" v-ripple class="chip" role="radio" :aria-checked="targetOverride.easing === key" :class="{ chosen: targetOverride.easing === key }" @click="targetOverride.easing = key">{{ easingMeta[key].label }}</button>
                </div>
                <button v-if="targetMeta.demo" v-ripple class="demo-play" type="button" aria-label="演示当前类别" @click="demoFor(targetMeta)"><Play :size="14" /> 演示 {{ targetMeta.label }}</button>
              </div>

              <div class="settings-group">
                <h3 class="group-caption">手感预设</h3>
                <button v-for="(preset, i) in motionPresets" :key="preset.id" v-ripple class="row" @click="applyPreset(i)">
                  <Settings class="row-icon" :size="22" />
                  <span class="row-text"><span class="row-title">{{ preset.label }}<span v-if="preset.id === 'telegram'" class="row-badge">tweb 实测</span></span><small>{{ preset.desc }}</small></span>
                </button>
                <p class="group-hint">预设会重写时长、曲线与机制参数；「Telegram 官方手感」使用 tweb 源码中测得的真实数值（菜单 .2s、标准曲线 cubic-bezier(.4,0,.2,1)、发送飞行 300 ms 双曲线等）。</p>
              </div>

              <div class="settings-group">
                <h3 class="group-caption">配置文件</h3>
                <div class="chips">
                  <button v-ripple class="chip" @click="doExport">导出 / 复制</button>
                  <button v-ripple class="chip" @click="doImport">导入</button>
                </div>
                <textarea v-model="configText" class="config-io" rows="5" aria-label="配置 JSON" placeholder="导出的配置会显示在这里，也可以粘贴别人的配置后点「导入」"></textarea>
              </div>
            </template>

            <!-- ============ lab ============ -->
            <template v-else>
              <SettingsMechanisms @toast="emit('toast',$event)"/>

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
