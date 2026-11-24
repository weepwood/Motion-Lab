import { computed, reactive, watch } from 'vue'
import { clamp, easingCss, easingOrder, type Bezier, type EasingKey } from './motion'

export type ThemeMode = 'light' | 'dark' | 'system'
export type PowerSavingMode = 'off' | 'battery' | 'always'
export type SendKey = 'enter' | 'ctrl-enter'
export type TimeFormat = '24h' | '12h'
/** 0 = off, 1 = reduced (displacement skipped, fades kept), 2 = full — mirrors tweb's liteMode levels. */
export type AnimationLevel = 0 | 1 | 2
export type AnimationKey = 'send' | 'incoming' | 'chat' | 'sidebar' | 'menu' | 'reaction' | 'particles' | 'wallpaper' | 'themeReveal' | 'ripple'
export type SettingsTab = 'main' | 'general' | 'animations' | 'lab' | 'export'
export type DemoKey = 'send' | 'incoming' | 'chat' | 'sidebar' | 'menu' | 'reaction' | 'swipe' | 'theme' | 'delete' | 'stress'

/** Per-category override; `null` means "follow the global settings". */
export interface CategoryOverride {
  duration: number | null
  easing: EasingKey | null
}

/**
 * Mechanism-level parameters (tier 3 of the config model). Defaults mirror the
 * values measured from the original Telegram Web source, so tweaking them here
 * means tweaking the exact knobs tweb itself uses.
 */
export interface MechanismParams {
  /** Send flight horizontal bezier (tweb CURVE_X). */
  sendCurveX: Bezier
  /** Send flight vertical bezier, slightly slower so the path arcs (tweb CURVE_Y). */
  sendCurveY: Bezier
  /** Fade between the flying snapshot and the real bubble after it lands (tweb LAND_FADE). */
  sendLandFade: number
  /** Reaction flight: how high the parabola rises at mid-flight, in px (tweb ELEVATION). */
  reactionElevation: number
  /** Reaction flight: when the landing target becomes visible, as a fraction of the flight (tweb LANDING_UNTIL). */
  reactionLanding: number
  /** Swipe reply: maximum finger-following displacement before damping (tweb MAX). */
  swipeMax: number
  /** Swipe reply: trigger threshold as a fraction of swipeMax (tweb 0.75 → 48px of 64px). */
  swipeTrigger: number
  /** Ripple starting scale (tweb: 0 on desktop, 0.27 on touch — exposed as the desktop value). */
  rippleStart: number
  /** Ripple ending scale (tweb --ripple-end-scale: 2). */
  rippleEnd: number
  /** Column push: how far the leaving page parallaxes away, in % of its width (tweb 25%). */
  navParallax: number
  /** Column push: brightness of the leaving page while it slides away (80 = 80%). */
  navDim: number
  /** Scroll anchoring: keep the viewport stable when the message list changes (tweb scrollSaver). */
  scrollAnchor: boolean
}

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
  /** User-chosen animation level; environment (system / power saving) can only lower it. */
  animationLevel: AnimationLevel
  respectSystemMotion: boolean
  animations: Record<AnimationKey, boolean>
  overrides: Record<AnimationKey, CategoryOverride>
  mech: MechanismParams
  powerSaving: PowerSavingMode
  batteryThreshold: number
  autoReply: boolean
  showFps: boolean
}

export interface AnimationMeta {
  key: AnimationKey
  label: string
  desc: string
  /** Heavy effects only run at level 2 and are switched off while power saving (like Telegram's power-saving mode). */
  heavy: boolean
  /** Purely a displacement (no fade-only variant to degrade to): skipped entirely at level 1. */
  displacementOnly: boolean
  /** Multiplier applied to the base duration. */
  factor: number
  demo?: DemoKey
}

export const animationList: AnimationMeta[] = [
  { key: 'send', label: '发送消息', desc: '文字从输入框沿弧线飞入气泡', heavy: false, displacementOnly: true, factor: 1, demo: 'send' },
  { key: 'incoming', label: '新消息入场', desc: '收到的消息从底部浮现', heavy: false, displacementOnly: false, factor: 0.9, demo: 'incoming' },
  { key: 'chat', label: '聊天切换', desc: '会话之间的横向转场', heavy: false, displacementOnly: false, factor: 0.85, demo: 'chat' },
  { key: 'sidebar', label: '页面推入', desc: '设置子页面、移动端聊天推入', heavy: false, displacementOnly: false, factor: 1, demo: 'sidebar' },
  { key: 'menu', label: '菜单与弹窗', desc: '从锚点缩放展开的菜单', heavy: false, displacementOnly: false, factor: 0.62, demo: 'menu' },
  { key: 'reaction', label: '表情回应', desc: '表情沿抛物线飞向气泡并弹跳', heavy: false, displacementOnly: false, factor: 1.4, demo: 'reaction' },
  { key: 'particles', label: '回应粒子', desc: '回应时迸发的小表情', heavy: true, displacementOnly: true, factor: 1.6, demo: 'reaction' },
  { key: 'wallpaper', label: '渐变壁纸', desc: '发送消息时背景色块流动', heavy: true, displacementOnly: true, factor: 1.8, demo: 'send' },
  { key: 'themeReveal', label: '主题扩散', desc: '切换夜间模式时圆形展开', heavy: true, displacementOnly: true, factor: 1.8, demo: 'theme' },
  { key: 'ripple', label: '点击涟漪', desc: '列表与按钮的水波纹反馈', heavy: true, displacementOnly: false, factor: 1.5 }
]

const metaMap = Object.fromEntries(animationList.map(m => [m.key, m])) as Record<AnimationKey, AnimationMeta>

export const timeScales = [1, 2, 5, 10]

export function defaultOverrides(): Record<AnimationKey, CategoryOverride> {
  const empty: CategoryOverride = { duration: null, easing: null }
  return Object.fromEntries(animationList.map(m => [m.key, { ...empty }])) as Record<AnimationKey, CategoryOverride>
}

/** Values measured from Telegram Web's source (`sendFlights.ts`, `reactionFlight.ts`, `bubbles.ts`, `base.scss`). */
export function defaultMechanics(): MechanismParams {
  return {
    sendCurveX: [0.23, 1, 0.32, 1],
    sendCurveY: [0.1992, 0.0106, 0.2792, 0.9103],
    sendLandFade: 100,
    reactionElevation: 30,
    reactionLanding: 0.75,
    swipeMax: 64,
    swipeTrigger: 0.75,
    rippleStart: 0,
    rippleEnd: 2,
    navParallax: 25,
    navDim: 80,
    scrollAnchor: true
  }
}

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
    animationLevel: 2,
    respectSystemMotion: true,
    animations: { send: true, incoming: true, chat: true, sidebar: true, menu: true, reaction: true, particles: true, wallpaper: true, themeReveal: true, ripple: true },
    overrides: defaultOverrides(),
    mech: defaultMechanics(),
    powerSaving: 'off',
    batteryThreshold: 15,
    autoReply: true,
    showFps: false
  }
}

const STORAGE_KEY = 'motion-lab-settings-v3'
const LEGACY_V2_KEY = 'motion-lab-settings-v2'
const LEGACY_THEME_KEY = 'motion-lab-theme'

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed as readonly unknown[]).includes(v) ? v as T : fallback
const num = (v: unknown, min: number, max: number, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : fallback
const bool = (v: unknown, fallback: boolean) => typeof v === 'boolean' ? v : fallback
const bezier = (v: unknown, fallback: Bezier): Bezier =>
  Array.isArray(v) && v.length === 4 && v.every(n => typeof n === 'number' && Number.isFinite(n))
    ? [clamp(v[0] as number, 0, 1), clamp(v[1] as number, -1, 2), clamp(v[2] as number, 0, 1), clamp(v[3] as number, -1, 2)]
    : fallback

function sanitizeOverride(v: unknown): CategoryOverride {
  const d: CategoryOverride = { duration: null, easing: null }
  if (!isObject(v)) return d
  return {
    duration: v.duration === null ? null : num(v.duration, 0, 1000, d.duration ?? 0) || null,
    easing: v.easing === null ? null : pick(v.easing, easingOrder, 'telegram')
  }
}

function sanitizeMech(v: unknown): MechanismParams {
  const d = defaultMechanics()
  if (!isObject(v)) return d
  return {
    sendCurveX: bezier(v.sendCurveX, d.sendCurveX),
    sendCurveY: bezier(v.sendCurveY, d.sendCurveY),
    sendLandFade: num(v.sendLandFade, 0, 600, d.sendLandFade),
    reactionElevation: num(v.reactionElevation, 0, 160, d.reactionElevation),
    reactionLanding: num(v.reactionLanding, 0.3, 1, d.reactionLanding),
    swipeMax: num(v.swipeMax, 16, 200, d.swipeMax),
    swipeTrigger: num(v.swipeTrigger, 0.2, 1, d.swipeTrigger),
    rippleStart: num(v.rippleStart, 0, 1, d.rippleStart),
    rippleEnd: num(v.rippleEnd, 1, 4, d.rippleEnd),
    navParallax: num(v.navParallax, 0, 100, d.navParallax),
    navDim: num(v.navDim, 40, 100, d.navDim),
    scrollAnchor: bool(v.scrollAnchor, d.scrollAnchor)
  }
}

/** Validate untrusted storage content field by field, so a bad value never breaks the app. */
export function sanitize(input: unknown): Settings {
  const d = defaultSettings()
  if (!isObject(input)) return d
  const anim = isObject(input.animations) ? input.animations : {}
  const animations = { ...d.animations }
  for (const key of Object.keys(animations) as AnimationKey[]) animations[key] = bool(anim[key], d.animations[key])
  const rawOverrides = isObject(input.overrides) ? input.overrides : {}
  const overrides = defaultOverrides()
  for (const key of Object.keys(overrides) as AnimationKey[]) overrides[key] = sanitizeOverride(rawOverrides[key])
  // v2 migration: the old master switch becomes the closest level.
  const rawLevel = input.animationLevel
  const levelFromLegacy: AnimationLevel = rawLevel === 0 || rawLevel === 1 || rawLevel === 2
    ? rawLevel
    : bool(input.interfaceAnimations, true) ? 2 : 0
  return {
    theme: pick(input.theme, ['light', 'dark', 'system'] as const, d.theme),
    textSize: num(input.textSize, 12, 22, d.textSize),
    bubbleRadius: num(input.bubbleRadius, 4, 20, d.bubbleRadius),
    sendKey: pick(input.sendKey, ['enter', 'ctrl-enter'] as const, d.sendKey),
    timeFormat: pick(input.timeFormat, ['24h', '12h'] as const, d.timeFormat),
    easing: pick(input.easing, easingOrder, d.easing),
    customBezier: bezier(input.customBezier, d.customBezier),
    springBounce: num(input.springBounce, 0, 0.6, d.springBounce),
    duration: num(input.duration, 120, 650, d.duration),
    timeScale: timeScales.includes(input.timeScale as number) ? input.timeScale as number : d.timeScale,
    animationLevel: levelFromLegacy,
    respectSystemMotion: bool(input.respectSystemMotion, d.respectSystemMotion),
    animations,
    overrides,
    mech: sanitizeMech(input.mech),
    powerSaving: pick(input.powerSaving, ['off', 'battery', 'always'] as const, d.powerSaving),
    batteryThreshold: num(input.batteryThreshold, 5, 50, d.batteryThreshold),
    autoReply: bool(input.autoReply, d.autoReply),
    showFps: bool(input.showFps, d.showFps)
  }
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_V2_KEY)
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
  settings.overrides = defaultOverrides()
  settings.mech = defaultMechanics()
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
export const powerSavingActive = computed(() => settings.powerSaving === 'always'
  || (settings.powerSaving === 'battery' && battery.supported && !battery.charging && battery.level * 100 <= settings.batteryThreshold))

/**
 * Effective animation level (tweb getAnimationLevel): the user's choice can only
 * be lowered — the system's "reduce motion" wins, power saving drops to level 1.
 */
export const effectiveLevel = computed<AnimationLevel>(() => {
  let level = settings.animationLevel
  if (systemReducing.value) level = 0
  if (powerSavingActive.value) level = Math.min(level, 1) as AnimationLevel
  return level
})
export const motionDisabled = computed(() => effectiveLevel.value === 0)
export const resolvedTheme = computed<'light' | 'dark'>(() => settings.theme === 'system' ? (system.dark ? 'dark' : 'light') : settings.theme)
export const easing = computed(() => easingCss(settings.easing, settings.customBezier, settings.springBounce))

/** Effective easing for one category, honouring its override (tier 2 of the config model). */
export function easingFor(key: AnimationKey): string {
  const override = settings.overrides[key].easing
  if (!override) return easing.value
  return easingCss(override, settings.customBezier, settings.springBounce)
}

/** Why a category is currently off or degraded, or '' when it is running. */
export function blockedReason(key: AnimationKey): string {
  if (effectiveLevel.value === 0) return systemReducing.value ? '系统已开启「减少动态效果」' : '界面动画已关闭'
  const meta = metaMap[key]
  if (effectiveLevel.value === 1 && (meta.heavy || meta.displacementOnly)) {
    return powerSavingActive.value ? '降级模式中已停用（省电中）' : '降级模式中已停用（仅保留淡入淡出）'
  }
  if (meta.heavy && powerSavingActive.value) return '省电模式中已停用'
  return ''
}

export function isEnabled(key: AnimationKey): boolean {
  return !blockedReason(key) && settings.animations[key]
}

/**
 * Effective duration in ms for a category (0 = animation off). A per-category
 * override (tier 2) replaces the base×factor; environmental multipliers
 * (power saving ×0.75, slow-motion time scale) still apply on top.
 */
export function durationFor(key: AnimationKey): number {
  if (!isEnabled(key)) return 0
  const override = settings.overrides[key].duration
  const base = override !== null && override !== undefined ? override : settings.duration * metaMap[key].factor
  const power = powerSavingActive.value ? 0.75 : 1
  return Math.round(base * power * settings.timeScale)
}

/** Duration that only moves things (transform): collapses to 0 at level 1 so displacement is skipped. */
export function moveDurationFor(key: AnimationKey): number {
  if (effectiveLevel.value < 2) return 0
  return durationFor(key)
}

/** Duration for small state changes (hover, icon morph) that are always "interface" level. */
export const microDuration = computed(() => motionDisabled.value ? 0 : Math.round(Math.min(settings.duration, 260) * 0.55 * settings.timeScale))
