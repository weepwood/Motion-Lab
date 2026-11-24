/**
 * Types for motion-kit (keep in sync with the JSDoc in the .js files).
 */

export type Bezier = [number, number, number, number]

export declare const CURVES: {
  standard: Bezier
  exit: Bezier
  flightX: Bezier
  flightY: Bezier
  overshoot: Bezier
}

export declare function fastRaf(cb: () => void): void
export declare function doubleRaf(): Promise<void>
export declare function claimAnimation(key: unknown): {
  isCancelled: () => boolean
  cancelled: Promise<void>
  done: () => void
}
export declare function cancelAnimationByKey(key: unknown): void

export declare function bezierCss(b: Bezier): string
export declare function bezierValue(b: Bezier, x: number): number
export declare function springValue(t: number, bounce: number): number
export declare function springCss(bounce: number): string
export declare function supportsLinearEasing(): boolean
export declare function play(
  el: Element, frames: Keyframe[], duration: number, easing?: string, extra?: KeyframeAnimationOptions
): Animation | null
export declare function settle(animation: Animation | null | undefined): Promise<void>
export declare function drag(
  el: Element, handlers: { onStart?: (e: PointerEvent) => void; onUpdate?: (p: { dx: number; dy: number }, e: PointerEvent) => void; onEnd?: (e: PointerEvent) => void }
): () => void

export declare function flyClone(opts: {
  source: Element & { getBoundingClientRect(): DOMRect }
  target: Element & { getBoundingClientRect(): DOMRect }
  container: Element
  duration?: number
  curveX?: Bezier
  curveY?: Bezier
  landFade?: number
  key?: unknown
  reveal?: () => void
  className?: string
}): Promise<void>

export declare function flyParabola(opts: {
  source: Element | string
  target: Element & { getBoundingClientRect(): DOMRect }
  container: Element
  duration?: number
  elevation?: number
  landing?: number
  scaleStart?: number
  key?: unknown
  reveal?: () => void
}): Promise<void>

export declare function attachRipple(
  el: HTMLElement,
  opts?: { duration?: number; easing?: string; startScale?: number; endScale?: number; color?: string }
): () => void

export declare function attachSwipe(
  el: HTMLElement,
  opts?: {
    max?: number
    trigger?: number
    direction?: 'left' | 'right'
    onMove?: (state: { progress: number; distance: number }) => void
    onEnd?: (state: { distance: number; triggered: boolean }) => void
    returnEasing?: string
    returnDuration?: string
  }
): () => void

export declare function createScrollSaver(
  scroller: HTMLElement | (() => HTMLElement | null),
  rowSelector?: string
): { save(): void; restore(): void; forget(): void }

export declare function revealFrom(opts: {
  x?: number
  y?: number
  duration?: number
  easing?: string
  apply: () => void
}): Promise<void>
