import { TWEB_STANDARD } from './motion'
import { defaultMechanics, defaultOverrides, sanitize, settings, type AnimationKey, type Settings } from './settings'

/**
 * Motion presets. The "Telegram" preset applies the exact values measured from
 * tweb's source (see tweb research: base.scss tokens, sendFlights.ts,
 * reactionFlight.ts, bubbles.ts sweep constants) — so the lab can flip between
 * "how this project used to feel" and "how the real Telegram Web feels".
 */
export interface MotionPreset {
  id: string
  label: string
  desc: string
  /** Patch the live settings with this preset's values. */
  apply: () => void
}

function assignMotion(patch: Pick<Settings, 'duration' | 'easing' | 'customBezier'> & { overrides?: Partial<Record<AnimationKey, { duration: number | null; easing: null }>> }) {
  settings.duration = patch.duration
  settings.easing = patch.easing
  settings.customBezier = [...patch.customBezier] as Settings['customBezier']
  const overrides = defaultOverrides()
  for (const [key, value] of Object.entries(patch.overrides ?? {})) {
    overrides[key as AnimationKey] = { duration: value?.duration ?? null, easing: null }
  }
  settings.overrides = overrides
  settings.mech = defaultMechanics()
}

const motionlab: MotionPreset = {
  id: 'motionlab',
  label: 'Motion Lab',
  desc: `本项目默认手感：${320} ms 基础时长 + Telegram 出口曲线`,
  apply: () => assignMotion({ duration: 320, easing: 'telegram', customBezier: [0.3, 0.9, 0.2, 1.1] })
}

/**
 * tweb's own numbers: .2s menus, .3s standard enter, 300 ms dual-curve send
 * flight, 300 ms reaction parabola, 600 ms theme reveal, .7s ripple.
 */
const telegram: MotionPreset = {
  id: 'telegram',
  label: 'Telegram 官方手感',
  desc: '来自 tweb 源码的实测数值（标准曲线 cubic-bezier(.4,0,.2,1)）',
  apply: () => assignMotion({
    duration: 300,
    easing: 'custom',
    customBezier: [...TWEB_STANDARD],
    overrides: {
      menu: { duration: 200, easing: null },        // --btn-menu-transition .2s
      sidebar: { duration: 200, easing: null },      // --layer-transition .2s
      chat: { duration: 300, easing: null },         // slideNavigation in .3s / out .25s
      incoming: { duration: 300, easing: null },     // scroll-reveal, no keyframe entrance
      send: { duration: 300, easing: null },         // sendFlights DURATION
      reaction: { duration: 300, easing: null },     // reactionFlight DURATION
      themeReveal: { duration: 600, easing: null },  // night reveal 600 ms
      ripple: { duration: 700, easing: null },      // --ripple-duration .7s
      particles: { duration: 480, easing: null },   // 本项目自有：粒子迸发
      wallpaper: { duration: 500, easing: null }    // 本项目自有：壁纸流动
    }
  })
}

export const motionPresets: MotionPreset[] = [motionlab, telegram]

function assignSettings(value: Settings) {
  Object.assign(settings, value)
  settings.overrides = value.overrides
  settings.mech = value.mech
}

/** Serialize the current settings (validated) for export. */
export function exportSettings(): string {
  return JSON.stringify({ preset: 'motion-lab', version: 3, ...settings, overrides: { ...settings.overrides }, mech: { ...settings.mech } }, null, 2)
}

/** Import settings JSON; returns an error message on failure, '' on success. */
export function importSettings(text: string): string {
  try {
    const parsed = JSON.parse(text)
    const next = sanitize(parsed)
    // A config someone else exported; unknown fields would fall back to defaults.
    if (!parsed || typeof parsed !== 'object' || !('duration' in parsed || 'easing' in parsed || 'mech' in parsed)) {
      return '这不是 Motion Lab 的配置文件'
    }
    assignSettings(next)
    return ''
  } catch {
    return 'JSON 解析失败，请检查内容格式'
  }
}
