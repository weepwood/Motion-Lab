import { ref, onBeforeUnmount } from 'vue'
export function usePlayback(render:(ms:number)=>void, total:()=>number) {
  const time=ref(0), playing=ref(false), speed=ref(1)
  let raf=0, last=0
  function seek(ms:number){time.value=Math.max(0,Math.min(total(),ms));render(time.value)}
  function pause(){cancelAnimationFrame(raf);playing.value=false;last=0}
  function frame(now:number){if(!playing.value)return;if(last)seek(time.value+(now-last)*speed.value);last=now;if(time.value>=total()){pause();return}raf=requestAnimationFrame(frame)}
  function play(){pause();if(matchMedia('(prefers-reduced-motion: reduce)').matches){seek(total());return}if(time.value>=total())seek(0);playing.value=true;raf=requestAnimationFrame(frame)}
  onBeforeUnmount(pause)
  return {time,playing,speed,seek,pause,play}
}
