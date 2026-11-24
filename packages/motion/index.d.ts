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
export declare function holdHeavyAnimations(promise: Promise<unknown>, timeout?: number): void
export declare function isHeavyAnimationHeld(): boolean

export declare function bezierCss(b: Bezier): string
export declare function clamp(n: number, min: number, max: number): number
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

export type RectLike = Element | DOMRect | { left: number; top: number; width: number; height: number }

export declare function flyClone(opts: {
  source: Element & { getBoundingClientRect(): DOMRect }
  from?: RectLike
  target: RectLike
  container: Element
  duration?: number
  curveX?: Bezier
  curveY?: Bezier
  landFade?: number
  key?: unknown
  reveal?: () => void
  className?: string
  hold?: boolean
}): Promise<void>

export declare function flyParabola(opts: {
  source: Element | string
  from?: RectLike
  target: RectLike
  container: Element
  duration?: number
  elevation?: number
  landing?: number
  scaleStart?: number
  key?: unknown
  reveal?: () => void
  className?: string
  hold?: boolean
}): Promise<void>

export declare function burstParticles(
  emoji: string, at: DOMRect, container: Element, duration?: number, className?: string
): Promise<void>

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
    ignore?: string
    onLock?: () => void
    onReset?: () => void
    onLongPress?: () => void
    onMove?: (state: { progress: number; distance: number }) => void
    onEnd?: (state: { distance: number; triggered: boolean }) => void
    returnEasing?: string
    returnDuration?: string
  }
): () => void

export declare function createScrollSaver(
  scroller: HTMLElement | (() => HTMLElement | null),
  rowSelector?: string,
  keyAttr?: string
): { save(): void; restore(): void; forget(): void }

export declare function revealFrom(opts: {
  x?: number
  y?: number
  duration?: number
  easing?: string
  apply: () => void | Promise<void>
}): Promise<void>

export type LayoutOptions = { duration?: number; easing?: string }
export declare function captureLayout(elements: Iterable<Element>): Map<Element, DOMRect>
export declare function animateLayout(before: Map<Element, DOMRect>, options?: LayoutOptions): Animation[]
export declare function sharedElement(source: Element, target: Element, options?: LayoutOptions): Animation[]
export declare function springFrames(from: number, to: number, bounce?: number, samples?: number): { offset: number; value: number }[]
export declare function staggerIn(elements: Iterable<Element>, options?: LayoutOptions & { stagger?: number; distance?: number }): Animation[]
export declare function cancelLayout(elements: Iterable<Element>): void
