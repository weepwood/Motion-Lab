export type GestureSample={t:number;x:number;y:number}
export function createGestureRecording(){
  let start=0, data:GestureSample[]=[]
  return {
    begin(){start=performance.now();data=[{t:0,x:0,y:0}]},
    add(x:number,y:number){if(data.length<1500)data.push({t:Math.round(performance.now()-start),x,y})},
    finish(){return data.map(p=>({...p}))}
  }
}
export function gestureFrames(samples:GestureSample[]):Keyframe[]{
  const end=Math.max(1,samples.at(-1)?.t??0)
  const result=samples.filter((s,i)=>i===samples.length-1||s.t!==samples[i+1].t)
  return result.map(s=>({offset:s.t/end,transform:'translate('+s.x+'px,'+s.y+'px)'}))
}
