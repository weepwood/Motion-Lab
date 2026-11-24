<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
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
import {
  buildEffectPrompt, buildSystemPrompt, exportableEffects, frameworkLabels, styleLabels,
  type EffectId, type Framework, type ImplStyle
} from '../aiExport'
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
const titles: Record<SettingsTab, string> = { main: '设置', general: '通用设置', animations: '动画与省电', lab: '动效实验室', export: 'AI 复刻导出' }

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
  if (settings.animationLevel === 0) return '已关闭'
  if (motionDisabled.value) return '跟随系统 · 已减少'
  if (effectiveLevel.value === 1) return `降级模式 · ${easingMeta[settings.easing].label}`
  return `${easingMeta[settings.easing].label} · ${settings.duration} ms${powerSavingActive.value ? ' · 省电中' : ''}`
})
const breakdown: [AnimationKey, string][] = [['send', '发送'], ['chat', '切换'], ['sidebar', '推入'], ['menu', '菜单'], ['reaction', '回应']]
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

/* ---- mechanism parameters (tier 3) ---- */
function mechDrag(target: 'sendCurveX' | 'sendCurveY') {
  return (value: Bezier) => { settings.mech[target] = value }
}
function resetMech() {
  settings.mech = defaultMechanics()
  emit('toast', '机制参数已恢复 tweb 实测默认值')
}

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

/* ---- AI 复刻导出 ---- */
const effects = exportableEffects()
const effectTarget = ref<EffectId>('send')
const framework = ref<Framework>('react')
const implStyle = ref<ImplStyle>('waapi')
const exportAll = ref(false)
const promptBox = ref<HTMLTextAreaElement | null>(null)

const options = computed(() => ({ framework: framework.value, style: implStyle.value }))
/**
 * 提示词是一份 computed：生成过程中读到的每一个配置量（基础时长、类别覆盖、
 * 机制参数、动画等级、省电模式、系统「减少动态效果」、电池状态……）都会被
 * 自动追踪，任何一个变动都会让提示词重算——不用手工维护依赖清单，也就不会
 * 出现「改了设置但导出的还是旧数值」。
 */
const promptText = computed(() => (exportAll.value
  ? buildSystemPrompt(options.value)
  : buildEffectPrompt(effectTarget.value, options.value)))

function copyPrompt() {
  const write = navigator.clipboard?.writeText(promptText.value)
  if (!write) {
    promptBox.value?.focus()
    promptBox.value?.select()
    emit('toast', '当前环境没有剪贴板权限，请全选复制文本框内容')
    return
  }
  void write.then(() => emit('toast', '提示词已复制，粘贴给 AI 即可复刻'), () => {
    promptBox.value?.focus()
    promptBox.value?.select()
    emit('toast', '浏览器拒绝了剪贴板，请全选复制文本框内容')
  })
}
function downloadPrompt() {
  const blob = new Blob([promptText.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (exportAll.value ? 'motion-lab-ai-system' : 'motion-lab-ai-' + effectTarget.value) + '.md'
  a.style.display = 'none'
  document.body.append(a)
  a.click()
  a.remove()
  // 立即 revoke 会让部分浏览器（Safari / 旧 Firefox）拿不到文件内容
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  emit('toast', '已下载 .md 文件')
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
                  <span class="row-text"><span class="row-title">AI 复刻导出<span class="row-badge">新</span></span><small>把当前手感变成给 AI 的复刻提示词</small></span>
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

            <!-- ============ AI export ============ -->
            <template v-else-if="current === 'export'">
              <div class="settings-group">
                <h3 class="group-caption">导出什么</h3>
                <ToggleRow v-model="exportAll" label="导出全套动效系统" desc="打开后一次性导出 12 个效果的完整规范（给 AI 做整套设计系统）" />
                <div v-if="!exportAll" class="chips" role="radiogroup" aria-label="选择要导出的动效">
                  <button v-for="e in effects" :key="e.id" v-ripple class="chip" role="radio" :aria-checked="effectTarget === e.id" :class="{ chosen: effectTarget === e.id }" @click="effectTarget = e.id">{{ e.title.split('（')[0] }}</button>
                </div>
                <p class="group-hint">
                  提示词由<b>当前实时配置</b>生成：基础时长、类别覆盖、机制参数（飞行曲线/阻尼/阈值……）都会写进去，
                  另附加机器可读 JSON 规范。把下面的文本复制或下载后交给任何 AI，即可在其他项目复现这个手感。
                </p>
              </div>
              <div class="settings-group">
                <h3 class="group-caption">目标环境</h3>
                <div class="chips" role="radiogroup" aria-label="目标框架">
                  <button v-for="(label, key) in frameworkLabels" :key="key" v-ripple class="chip" role="radio" :aria-checked="framework === key" :class="{ chosen: framework === key }" @click="framework = key as Framework">{{ label }}</button>
                </div>
                <div class="chips" role="radiogroup" aria-label="实现方式">
                  <button v-for="(label, key) in styleLabels" :key="key" v-ripple class="chip" role="radio" :aria-checked="implStyle === key" :class="{ chosen: implStyle === key }" @click="implStyle = key as ImplStyle">{{ label }}</button>
                </div>
                <div class="chips">
                  <button v-ripple class="chip" @click="copyPrompt">复制提示词</button>
                  <button v-ripple class="chip" @click="downloadPrompt">下载 .md</button>
                </div>
              </div>
              <div class="settings-group">
                <h3 class="group-caption">复刻提示词 <small>{{ promptText.length }} 字符</small></h3>
                <textarea ref="promptBox" class="config-io export-io" readonly :value="promptText" aria-label="AI 复刻提示词"></textarea>
              </div>
            </template>

            <!-- ============ lab ============ -->
            <template v-else>
              <div class="settings-group">
                <h3 class="group-caption">机制参数 <small>tweb 手感的第一手数值</small> <button class="mini-btn" type="button" @click="resetMech">恢复默认</button></h3>
                <h4 class="group-caption sub">发送飞行 · tweb sendFlights</h4>
                <CurveEditor easing-key="custom" :bezier="settings.mech.sendCurveX" :bounce="0" :duration="durationFor('send')" :css="''" @drag="mechDrag('sendCurveX')" />
                <p class="group-hint">横向曲线 CURVE_X（快出）≈ cubic-bezier(.23,1,.32,1)</p>
                <CurveEditor easing-key="custom" :bezier="settings.mech.sendCurveY" :bounce="0" :duration="durationFor('send')" :css="''" @drag="mechDrag('sendCurveY')" />
                <p class="group-hint">纵向曲线 CURVE_Y（上抛更缓）≈ cubic-bezier(.1992,.0106,.2792,.9103)。两条曲线不同 → 气泡走出弧线；落位后交叉淡出 {{ settings.mech.sendLandFade }} ms。</p>
                <div class="slider-row"><RangeSlider v-model="settings.mech.sendLandFade" :min="0" :max="400" :step="10" label="落位淡出 ms" /><b class="slider-value">{{ settings.mech.sendLandFade }}</b></div>

                <h4 class="group-caption sub">表情飞行 · tweb reactionFlight</h4>
                <div class="slider-row"><RangeSlider v-model="settings.mech.reactionElevation" :min="0" :max="120" :step="2" label="抛物线抬升 px" /><b class="slider-value">{{ settings.mech.reactionElevation }}</b></div>
                <div class="slider-row"><RangeSlider v-model="settings.mech.reactionLanding" :min="0.3" :max="1" :step="0.05" label="落点显影位置" /><b class="slider-value">{{ Math.round(settings.mech.reactionLanding * 100) }}%</b></div>

                <h4 class="group-caption sub">滑动回复 · tweb bubbles</h4>
                <div class="slider-row"><RangeSlider v-model="settings.mech.swipeMax" :min="16" :max="200" :step="4" label="最大跟手位移 px" /><b class="slider-value">{{ settings.mech.swipeMax }} px</b></div>
                <div class="slider-row"><RangeSlider v-model="settings.mech.swipeTrigger" :min="0.2" :max="1" :step="0.05" label="触发阈值比例" /><b class="slider-value">{{ Math.round(settings.mech.swipeTrigger * settings.mech.swipeMax) }} px</b></div>

                <h4 class="group-caption sub">涟漪</h4>
                <div class="slider-row"><RangeSlider v-model="settings.mech.rippleStart" :min="0" :max="1" :step="0.05" label="起始 scale" /><b class="slider-value">{{ settings.mech.rippleStart }}</b></div>
                <div class="slider-row"><RangeSlider v-model="settings.mech.rippleEnd" :min="1" :max="4" :step="0.1" label="结束 scale" /><b class="slider-value">{{ settings.mech.rippleEnd }}</b></div>

                <h4 class="group-caption sub">列推挤转场 · tweb slideNavigation</h4>
                <div class="slider-row"><RangeSlider v-model="settings.mech.navParallax" :min="0" :max="60" :step="5" label="旧页视差 %" /><b class="slider-value">{{ settings.mech.navParallax }}%</b></div>
                <div class="slider-row"><RangeSlider v-model="settings.mech.navDim" :min="40" :max="100" :step="5" label="旧页亮度 %" /><b class="slider-value">{{ settings.mech.navDim }}%</b></div>

                <h4 class="group-caption sub">滚动锚点 · tweb scrollSaver</h4>
                <ToggleRow v-model="settings.mech.scrollAnchor" label="锚点补偿" desc="加载历史消息时保持视口钉在原消息上" />
              </div>

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
