/**
 * motion-kit — zero-dependency web motion toolkit.
 * Principles distilled from an independent study of Telegram Web's animation
 * architecture; all code here is original (MIT).
 */

export {
  fastRaf, doubleRaf, claimAnimation, cancelAnimationByKey,
  holdHeavyAnimations, isHeavyAnimationHeld
} from './engine.js'
export {
  CURVES, clamp, bezierCss, bezierValue, springValue, springCss, supportsLinearEasing,
  play, settle, drag
} from './easing.js'
export { flyClone, flyParabola, burstParticles } from './flight.js'
export { attachRipple } from './ripple.js'
export { attachSwipe } from './gestures.js'
export { createScrollSaver } from './scroll-saver.js'
export { revealFrom } from './reveal.js'

export { captureLayout, animateLayout, sharedElement, springFrames, staggerIn, cancelLayout } from './layout.js'

export { physicalSpringFrames } from './layout.js'
