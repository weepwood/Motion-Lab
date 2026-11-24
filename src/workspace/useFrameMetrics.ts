import { ref, computed, onBeforeUnmount } from 'vue'
export function useFrameMetrics(){
  const intervals=ref<number[]>([]),measuring=ref(false)
  let raf=0
  function stop(){cancelAnimationFrame(raf);measuring.value=false}
  function measure(){
    stop();intervals.value=[];measuring.value=true
    const samples:number[]=[];let begin:number|null=null,last:number|null=null
    const tick=(now:number)=>{
      if(!measuring.value)return
      if(document.hidden){stop();return}
      if(begin===null)begin=now
      if(last!==null&&now>last)samples.push(now-last)
      last=now
      if(now-begin<2000)raf=requestAnimationFrame(tick)
      else{intervals.value=samples;stop()}
    }
    raf=requestAnimationFrame(tick)
  }
  onBeforeUnmount(stop)
  const perf=computed(()=>{
    const a=[...intervals.value].sort((x,y)=>x-y);if(!a.length)return null
    const median=a[Math.floor(a.length/2)]
    return {median,p95:a[Math.floor((a.length-1)*.95)],max:a[a.length-1],missed:a.reduce((s,x)=>s+Math.max(0,Math.round(x/median)-1),0),bins:[a.filter(x=>x<=median*1.5).length,a.filter(x=>x>median*1.5&&x<=median*2.5).length,a.filter(x=>x>median*2.5).length]}
  })
  return {intervals,measuring,measure,perf}
}
