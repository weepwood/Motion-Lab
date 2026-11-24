/**
 * motion-kit — engine
 * --------------------------------------------------------------------
 * Two ideas ported from the study of Telegram Web's scheduler/animation
 * layers, trimmed to their essence:
 *
 *  1. `fastRaf`  — one requestAnimationFrame for the whole page: every
 *     caller scheduled in the same frame runs in the same rAF callback.
 *  2. `claimAnimation(key)` — a keyed instance table. Starting a new
 *     animation with the same key automatically cancels the previous
 *     holder, and its cleanup callbacks still run. No more stacked
 *     flights on one element.
 *
 * Zero dependencies, framework-free.
 */

/**
 * @typedef {Object} MotionClaim
 * @property {() => boolean} isCancelled   true once a newer claim stole the key
 * @property {Promise<void>} cancelled     resolves when this claim was superseded
 * @property {() => void}     done          call when the animation finished naturally
 */

const instances = new Map()

/** Cancel the animation instance registered under `key` (if any). */
export function cancelAnimationByKey(key) {
  const instance = instances.get(key)
  instances.delete(key)
  if (instance) {
    instance.cancelled = true
    instance.resolve()
  }
}

/**
 * Reserve `key` for a new animation, cancelling the previous holder.
 * @param {unknown} key
 * @returns {MotionClaim}
 */
export function claimAnimation(key) {
  cancelAnimationByKey(key)
  let resolve
  const cancelled = new Promise(r => { resolve = r })
  const instance = { cancelled: false, resolve }
  instances.set(key, instance)
  cancelled.catch(() => {}) // cancellation is a normal outcome, never a rejection
  return {
    isCancelled: () => instance.cancelled,
    cancelled,
    done: () => {
      if (instances.get(key) === instance) instances.delete(key)
      instance.resolve()
    }
  }
}

/* --------------------------------------------------------------- fastRaf */

let rafCallbacks = []
let rafHandle = 0

function flushRaf() {
  const callbacks = rafCallbacks
  rafCallbacks = []
  rafHandle = 0
  for (const cb of callbacks) {
    try { cb() } catch { /* one broken callback must not break the frame */ }
  }
}

/**
 * Schedule `cb` for the next animation frame, batched with every other caller
 * registered this frame (single shared rAF).
 * @param {() => void} cb
 */
export function fastRaf(cb) {
  if (!rafHandle) rafHandle = requestAnimationFrame(flushRaf)
  rafCallbacks.push(cb)
}

/** Wait two rAF ticks: layout done + one paint settled (tweb uses this before adding `.active`). */
export function doubleRaf() {
  return new Promise(resolve => { fastRaf(() => fastRaf(resolve)) })
}
