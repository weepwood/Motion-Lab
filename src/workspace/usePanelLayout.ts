import {ref,watch} from 'vue'
type Side='left'|'right'
export function usePanelLayout(){
 const leftOpen=ref(true),rightOpen=ref(true),leftWidth=ref(244),rightWidth=ref(326)
 const clamp=(side:Side,n:number)=>Math.max(side==='left'?180:240,Math.min(side==='left'?400:460,n))
 try{const raw=JSON.parse(localStorage.getItem('motion-lab-panels-v1')||'null');if(raw){if(typeof raw.left==='number'&&Number.isFinite(raw.left))leftWidth.value=clamp('left',raw.left);if(typeof raw.right==='number'&&Number.isFinite(raw.right))rightWidth.value=clamp('right',raw.right)}}catch{}
 watch([leftWidth,rightWidth],()=>{try{localStorage.setItem('motion-lab-panels-v1',JSON.stringify({left:leftWidth.value,right:rightWidth.value}))}catch{}},{flush:'post'})
 let drag:{side:Side;id:number;start:number;width:number}|null=null
 const target=(side:Side)=>side==='left'?leftWidth:rightWidth
 function resizeStart(e:PointerEvent,side:Side){if(e.button!==0)return;drag={side,id:e.pointerId,start:e.clientX,width:target(side).value};(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)}
 function resizeMove(e:PointerEvent){if(!drag||drag.id!==e.pointerId)return;target(drag.side).value=clamp(drag.side,drag.width+(e.clientX-drag.start)*(drag.side==='left'?1:-1))}
 function resizeEnd(e:PointerEvent){if(drag?.id===e.pointerId)drag=null}
 function resizeKey(e:KeyboardEvent,side:Side){if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();target(side).value=clamp(side,target(side).value+(e.key==='ArrowRight'?10:-10)*(side==='left'?1:-1))}
 return {leftOpen,rightOpen,leftWidth,rightWidth,resizeStart,resizeMove,resizeEnd,resizeKey}
}
