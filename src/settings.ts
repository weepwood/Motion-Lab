import { computed, reactive, watch } from 'vue'
import { clamp, easingCss, easingOrder, type Bezier, type EasingKey } from './motion'

export type ThemeMode = 'light' | 'dark' | 'system'
export type PowerSavingMode = 'off' | 'battery' | 'always'
export type SendKey = 'enter' | 'ctrl-enter'
export type TimeFormat = '24h' | '12h'
export type AnimationKey = 'send' | 'incoming' | 'chat' | 'sidebar' | 'menu' | 'reaction' | 'particles' | 'wallpaper' | 'themeReveal' | 'ripple'
export type SettingsTab = 'main' | 'general' | 'animations' | 'lab'
export type DemoKey = 'send' | 'incoming' | 'chat' | 'sidebar' | 'menu' | 'reaction' | 'swipe' | 'theme' | 'delete' | 'stress'

export interface Settings {
  theme: ThemeMode
  textSize: number
  bubbleRadius: number
  sendKey: SendKey
  timeFormat: TimeFormat
  easing: EasingKey
  customBezier: Bezier
  springBounce: number
  duration: number
  timeScale: number
  interfaceAnimations: boolean
  respectSystemMotion: boolean
  animations: Record<AnimationKey, boolean>
  powerSaving: PowerSavingMode
  batteryThreshold: number
  autoReply: boolean
  showFps: boolean
}

export interface AnimationMeta {
  key: AnimationKey
  label: string
  desc: string
  /** Heavy effects are switched off while power saving is active (like Telegram's power-saving mode). */
  heavy: boolean
  /** Multiplier applied to the base duration. */
  factor: number
  demo?: DemoKey
}

export const animationList: AnimationMeta[] = [
  { key: 'send', label: '发送消息', desc: '文字从输入框沿弧线飞入气泡', heavy: false, factor: 1, demo: 'send' },
  { key: 'incoming', label: '新消息入场', desc: '收到的消息从底部浮现', heavy: false, factor: 0.9, demo: 'incoming' },
  { key: 'chat', label: '聊天切换', desc: '会话之间的横向转场', heavy: false, factor: 0.85, demo: 'chat' },
  { key: 'sidebar', label: '页面推入', desc: '设置子页面、移动端聊天推入', heavy: false, factor: 1, demo: 'sidebar' },
  { key: 'menu', label: '菜单与弹窗', desc: '从锚点缩放展开的菜单', heavy: false, factor: 0.62, demo: 'menu' },
  { key: 'reaction', label: '表情回应', desc: '表情飞向气泡并弹跳', heavy: false, factor: 1.4, demo: 'reaction' },
  { key: 'particles', label: '回应粒子', desc: '回应时迸发的小表情', heavy: true, factor: 1.6, demo: 'reaction' },
  { key: 'wallpaper', label: '渐变壁纸', desc: '发送消息时背景色块流动', heavy: true, factor: 1.8, demo: 'send' },
  { key: 'themeReveal', label: '主题扩散', desc: '切换夜间模式时圆形展开', heavy: true, factor: 1.8, demo: 'theme' },
  { key: 'ripple', label: '点击涟漪', desc: '列表与按钮的水波纹反馈', heavy: true, factor: 1.5 }
]

const metaMap = Object.fromEntries(animationList.map(m => [m.key, m])) as Record<AnimationKey, AnimationMeta>

export const timeScales = [1, 2, 5, 10]

export function defaultSettings(): Settings {
  return {
    theme: 'light',
    textSize: 16,
    bubbleRadius: 15,
    sendKey: 'enter',
    timeFormat: '24h',
    easing: 'telegram',
    customBezier: [0.3, 0.9, 0.2, 1.1],
    springBounce: 0.3,
    duration: 320,
    timeScale: 1,
    interfaceAnimations: true,
    respectSystemMotion: true,
    animations: { send: true, incoming: true, chat: true, sidebar: true, menu: true, reaction: true, particles: true, wallpaper: true, themeReveal: true, ripple: true },
    powerSaving: 'off',
    batteryThreshold: 15,
    autoReply: true,
    showFps: false
  }
}

const STORAGE_KEY = 'motion-lab-settings-v2'
const LEGACY_THEME_KEY = 'motion-lab-theme'

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed as readonly unknown[]).includes(v) ? v as T : fallback
const num = (v: unknown, min: number, max: number, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : fallback
const bool = (v: unknown, fallback: boolean) => typeof v === 'boolean' ? v : fallback

/** Validate untrusted storage content field by field, so a bad value never breaks the app. */
export function sanitize(input: unknown): Settings {
  const d = defaultSettings()
  if (!isObject(input)) return d
  const anim = isObject(input.animations) ? input.animations : {}
  const animations = { ...d.animations }
  for (const key of Object.keys(animations) as AnimationKey[]) animations[key] = bool(anim[key], d.animations[key])
  const bez = Array.isArray(input.customBezier) && input.customBezier.length === 4 && input.customBezier.every(n => typeof n === 'number' && Number.isFinite(n))
    ? input.customBezier as number[]
    : d.customBezier
  return {
    theme: pick(input.theme, ['light', 'dark', 'system'] as const, d.theme),
    textSize: num(input.textSize, 12, 22, d.textSize),
    bubbleRadius: num(input.bubbleRadius, 4, 20, d.bubbleRadius),
    sendKey: pick(input.sendKey, ['enter', 'ctrl-enter'] as const, d.sendKey),
    timeFormat: pick(input.timeFormat, ['24h', '12h'] as const, d.timeFormat),
    easing: pick(input.easing, easingOrder, d.easing),
    customBezier: [clamp(bez[0] ?? 0, 0, 1), clamp(bez[1] ?? 0, -0.6, 1.6), clamp(bez[2] ?? 1, 0, 1), clamp(bez[3] ?? 1, -0.6, 1.6)],
    springBounce: num(input.springBounce, 0, 0.6, d.springBounce),
    duration: num(input.duration, 120, 650, d.duration),
    timeScale: timeScales.includes(input.timeScale as number) ? input.timeScale as number : d.timeScale,
    interfaceAnimations: bool(input.interfaceAnimations, d.interfaceAnimations),
    respectSystemMotion: bool(input.respectSystemMotion, d.respectSystemMotion),
    animations,
    powerSaving: pick(input.powerSaving, ['off', 'battery', 'always'] as const, d.powerSaving),
    batteryThreshold: num(input.batteryThreshold, 5, 50, d.batteryThreshold),
    autoReply: bool(input.autoReply, d.autoReply),
    showFps: bool(input.showFps, d.showFps)
  }
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return sanitize(JSON.parse(raw))
    const legacy = localStorage.getItem(LEGACY_THEME_KEY)
    const s = defaultSettings()
    if (legacy === 'light' || legacy === 'dark') s.theme = legacy
    return s
  } catch {
    return defaultSettings()
  }
}

export const settings = reactive<Settings>(load())

let saveTimer: ReturnType<typeof setTimeout> | undefined
watch(settings, () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* storage disabled */ }
  }, 120)
}, { deep: true })

/** Flush immediately (used before reload in tests and on page hide). */
export function persistNow() {
  if (saveTimer) clearTimeout(saveTimer)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch { /* storage disabled */ }
}

export function resetSettings() {
  Object.assign(settings, defaultSettings())
}

/* ---------- environment: OS preferences and battery ---------- */

export const system = reactive({ reducedMotion: false, dark: false })
export const battery = reactive({ supported: false, level: 1, charging: true })

type BatteryLike = EventTarget & { level: number; charging: boolean }

export function watchEnvironment(): () => void {
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  const scheme = matchMedia('(prefers-color-scheme: dark)')
  const sync = () => { system.reducedMotion = motion.matches; system.dark = scheme.matches }
  sync()
  motion.addEventListener('change', sync)
  scheme.addEventListener('change', sync)
  let batteryRef: BatteryLike | null = null
  const syncBattery = () => {
    if (!batteryRef) return
    battery.level = batteryRef.level
    battery.charging = batteryRef.charging
  }
  const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> }
  nav.getBattery?.().then(b => {
    batteryRef = b
    battery.supported = true
    syncBattery()
    b.addEventListener('levelchange', syncBattery)
    b.addEventListener('chargingchange', syncBattery)
  }).catch(() => { battery.supported = false })
  const onHide = () => persistNow()
  window.addEventListener('pagehide', onHide)
  return () => {
    motion.removeEventListener('change', sync)
    scheme.removeEventListener('change', sync)
    batteryRef?.removeEventListener('levelchange', syncBattery)
    batteryRef?.removeEventListener('chargingchange', syncBattery)
    window.removeEventListener('pagehide', onHide)
  }
}

/* ---------- derived motion state ---------- */

export const systemReducing = computed(() => settings.respectSystemMotion && system.reducedMotion)
export const motionDisabled = computed(() => !settings.interfaceAnimations || systemReducing.value)
export const powerSavingActive = computed(() => settings.powerSaving === 'always'
  || (settings.powerSaving === 'battery' && battery.supported && !battery.charging && battery.level * 100 <= settings.batteryThreshold))
export const resolvedTheme = computed<'light' | 'dark'>(() => settings.theme === 'system' ? (system.dark ? 'dark' : 'light') : settings.theme)
export const easing = computed(() => easingCss(settings.easing, settings.customBezier, settings.springBounce))

/** Why a category is currently off, or '' when it is running. */
export function blockedReason(key: AnimationKey): string {
  if (!settings.interfaceAnimations) return '界面动画已关闭'
  if (systemReducing.value) return '系统已开启「减少动态效果」'
  if (metaMap[key].heavy && powerSavingActive.value) return '省电模式中已停用'
  return ''
}

export function isEnabled(key: AnimationKey): boolean {
  return !blockedReason(key) && settings.animations[key]
}

/** Effective duration in ms for a category (0 = animation off). */
export function durationFor(key: AnimationKey): number {
  if (!isEnabled(key)) return 0
  const power = powerSavingActive.value ? 0.75 : 1
  return Math.round(settings.duration * metaMap[key].factor * power * settings.timeScale)
}

/** Duration for small state changes (hover, icon morph) that are always "interface" level. */
export const microDuration = computed(() => motionDisabled.value ? 0 : Math.round(Math.min(settings.duration, 260) * 0.55 * settings.timeScale))
