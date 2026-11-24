import { ref, onBeforeUnmount } from 'vue'
export function usePlayback(render:(ms:number)=>void, total:()=>number) {
  const time=ref(0), playing=ref(false), speed=ref(1), loop=ref(false)
  let raf=0, last:number|null=null
  function seek(ms:number){time.value=Math.max(0,Math.min(total(),Number.isFinite(ms)?ms:0));render(time.value)}
  function pause(){cancelAnimationFrame(raf);playing.value=false;last=null}
  function frame(now:number){
    if(!playing.value)return
    const duration=total()
    if(duration<=0){seek(0);pause();return}
    if(last!==null){
      const next=time.value+Math.max(0,now-last)*speed.value
      if(next>=duration){if(loop.value)seek(next%duration);else{seek(duration);pause();return}}
      else seek(next)
    }
    last=now;raf=requestAnimationFrame(frame)
  }
  function play(){
    pause()
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||total()<=0){seek(total());return}
    if(time.value>=total())seek(0)
    playing.value=true;raf=requestAnimationFrame(frame)
  }
  onBeforeUnmount(pause)
  return {time,playing,speed,loop,seek,pause,play}
}
