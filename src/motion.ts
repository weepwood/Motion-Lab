export type MotionPreset = 'telegram' | 'soft' | 'snappy' | 'spring'

export const motionPresets: Record<MotionPreset, { label: string; ease: string; description: string }> = {
  telegram: { label: 'Telegram', ease: 'cubic-bezier(.23,1,.32,1)', description: '快速响应，柔和减速' },
  soft: { label: '柔和', ease: 'cubic-bezier(.25,.1,.25,1)', description: '舒适的自然过渡' },
  snappy: { label: '灵敏', ease: 'cubic-bezier(.16,1,.3,1)', description: '更高的响应速度' },
  spring: { label: '回弹', ease: 'cubic-bezier(.34,1.56,.64,1)', description: '轻微弹性过冲' }
}

const active = new WeakMap<HTMLElement, Animation>()
export function playInterruptible(element: HTMLElement, frames: Keyframe[], duration: number, easing: string) {
  // Read the displayed state before cancelling: restarting cannot jump to the old initial frame.
  const computed = getComputedStyle(element)
  const previous = { transform: computed.transform, opacity: computed.opacity }
  active.get(element)?.cancel()
  if (duration <= 0) return
  const animation = element.animate(
    frames.map((frame, index) => index === 0
      ? { ...frame, transform: previous.transform === 'none' ? (frame.transform ?? 'none') : previous.transform, opacity: Number(previous.opacity) }
      : frame),
    { duration, easing, fill: 'none' }
  )
  active.set(element, animation)
  void animation.finished.catch(() => {}).finally(() => {
    if (active.get(element) === animation) active.delete(element)
  })
  return animation
}

let currentFlight: Animation | null = null
let currentGhost: HTMLElement | null = null

export function cancelFlight() {
  currentFlight?.cancel()
  currentFlight = null
  currentGhost?.remove()
  currentGhost = null
}

/**
 * FLIP send flight: the ghost is drawn at the final bubble coordinates,
 * and transformed from the composer origin. Avoid animating layout properties.
 * A new send or chat switch cancels the previous flight without hiding a bubble.
 */
export async function flyText(
  text: string, from: DOMRect, to: DOMRect, duration: number, ease: string,
  outgoingColor?: string, outgoingText?: string
): Promise<void> {
  cancelFlight()
  if (duration <= 0 || to.width <= 0 || to.height <= 0) return
  const ghost = document.createElement('div')
  ghost.className = 'flight-ghost'
  ghost.textContent = text
  ghost.style.left = to.left + 'px'
  ghost.style.top = to.top + 'px'
  ghost.style.width = to.width + 'px'
  ghost.style.maxWidth = to.width + 'px'
  ghost.style.minHeight = to.height + 'px'
  if (outgoingColor) ghost.style.background = outgoingColor
  if (outgoingText) ghost.style.color = outgoingText
  document.body.append(ghost)
  currentGhost = ghost
  const dx = from.left + Math.min(from.width * .25, 60) - to.left
  const dy = from.top + from.height / 2 - to.top - to.height / 2
  const scale = Math.max(.83, Math.min(1, from.width / Math.max(to.width, 1)))
  const animation = ghost.animate([
    { transform: `translate3d(${dx}px,${dy}px,0) scale(${scale})`, opacity: .35, offset: 0 },
    { transform: `translate3d(${dx * .38}px,${dy * .25}px,0) scale(.98)`, opacity: .95, offset: .68 },
    { transform: 'translate3d(0,0,0) scale(1)', opacity: 1, offset: 1 }
  ], { duration, easing: ease, fill: 'forwards' })
  currentFlight = animation
  try {
    await animation.finished
  } catch {
    // Intentional cancellation on navigation or rapid consecutive sends.
  } finally {
    if (currentFlight === animation) currentFlight = null
    if (currentGhost === ghost) currentGhost = null
    ghost.remove()
  }
}

export function systemReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
