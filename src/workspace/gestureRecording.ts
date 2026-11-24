export type GestureSample={t:number;x:number;y:number}
export function createGestureRecording(){
  let start=0, data:GestureSample[]=[]
  return {
    begin(x=0,y=0){start=performance.now();data=[{t:0,x,y}]},
    add(x:number,y:number){if(data.length<1500)data.push({t:Math.round(performance.now()-start),x,y})},
    finish(){const last=data.at(-1);if(last&&data.length<1500)data.push({...last,t:Math.round(performance.now()-start)});return data.map(p=>({...p}))}
  }
}
export function gestureFrames(samples:GestureSample[]):Keyframe[]{
  const end=Math.max(1,samples.at(-1)?.t??0)
  const result=samples.filter((s,i)=>i===samples.length-1||s.t!==samples[i+1].t)
  return result.map(s=>({offset:s.t/end,transform:'translate('+s.x+'px,'+s.y+'px)'}))
}

export function releaseVelocity(samples:GestureSample[]){
 const last=samples.at(-1),prior=[...samples].reverse().find(s=>last&&last.t-s.t>=20)
 if(!last||!prior||last.t-prior.t>100)return {x:0,y:0}
 const dt=(last.t-prior.t)/1000,clamp=(v:number)=>Math.max(-2000,Math.min(2000,v))
 return {x:clamp((last.x-prior.x)/dt),y:clamp((last.y-prior.y)/dt)}
}
