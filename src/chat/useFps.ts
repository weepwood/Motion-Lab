import {ref,watch,onBeforeUnmount} from 'vue'
export function useFps(enabled:()=>boolean){
const fps=ref(0),worstFrame=ref(0)
let fpsRaf = 0
function startFps() {
  let last = performance.now()
  let frames = 0
  let acc = 0
  let worst = 0
  const loop = (now: number) => {
    const dt = now - last
    last = now
    frames++
    acc += dt
    worst = Math.max(worst, dt)
    if (acc >= 500) {
      fps.value = Math.round((frames * 1000) / acc)
      worstFrame.value = Math.round(worst)
      frames = 0
      acc = 0
      worst = 0
    }
    fpsRaf = requestAnimationFrame(loop)
  }
  fpsRaf = requestAnimationFrame(loop)
}
watch(enabled, on => {
  cancelAnimationFrame(fpsRaf)
  if (on) startFps()
}, { immediate: true })


onBeforeUnmount(()=>cancelAnimationFrame(fpsRaf))
return {fps,worstFrame}
}
