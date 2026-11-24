/**
 * A trimmed port of tweb's animation engine ideas:
 *
 * - `fastRaf` batches all per-frame work into a single requestAnimationFrame
 *   (tweb `schedulers.ts`), so many simultaneous animations share one rAF loop.
 * - `doubleRaf` waits for layout + paint to settle before revealing elements
 *   (tweb uses this before adding `.active` to freshly inserted popups).
 * - Keyed animation instances (tweb `animation.ts`): registering a new instance
 *   under the same key automatically cancels the previous one — a second send
 *   into the same chat, or a second reaction on the same chip, can never pile
 *   up on top of a flight that is still running.
 *
 * Real per-frame animation runs through WAAPI (compositor-friendly, cancellable);
 * this module only owns scheduling and interruption.
 */

type AnimationInstance = {
  cancelled: boolean
  resolve: () => void
}

const instances = new Map<unknown, AnimationInstance>()

/** Cancel the animation instance registered under `key`, if any. */
export function cancelAnimationByKey(key: unknown): void {
  const instance = instances.get(key)
  instances.delete(key)
  if (instance) {
    instance.cancelled = true
    instance.resolve()
  }
}

/**
 * Reserve `key` for a new animation, cancelling the previous holder.
 * Returns the instance plus a promise that resolves when the holder is
 * cancelled — await it to react to interruption (remove clones, clean up).
 */
export function claimAnimation(key: unknown): { isCancelled: () => boolean; cancelled: Promise<void>; done: () => void } {
  cancelAnimationByKey(key)
  let resolve!: () => void
  const cancelled = new Promise<void>(r => { resolve = r })
  const instance: AnimationInstance = { cancelled: false, resolve }
  instances.set(key, instance)
  // Cancellation is a normal outcome, never a rejection.
  void cancelled.catch(() => {})
  return {
    isCancelled: () => instance.cancelled,
    cancelled,
    done: () => {
      if (instances.get(key) === instance) instances.delete(key)
      instance.resolve()
    }
  }
}

/* ---------------------------------------------------------------- fastRaf */

type Callback = () => void

let rafCallbacks: Callback[] = []
let rafHandle = 0

function flushRaf() {
  // Empty first so callbacks scheduled during the flush join the next frame.
  const callbacks = rafCallbacks
  rafCallbacks = []
  rafHandle = 0
  for (const cb of callbacks) {
    try { cb() } catch { /* one broken callback must not break the frame */ }
  }
}

/** Schedule `cb` for the next animation frame, batched with all other callers. */
export function fastRaf(cb: Callback): void {
  if (!rafHandle) rafHandle = requestAnimationFrame(flushRaf)
  rafCallbacks.push(cb)
}

/** Wait for two rAF ticks: layout done + one paint settled. */
export function doubleRaf(): Promise<void> {
  return new Promise<void>(resolve => {
    fastRaf(() => fastRaf(resolve))
  })
}
