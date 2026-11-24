import {ref,watch,onMounted,onBeforeUnmount} from 'vue'
type Side='left'|'right'
export function usePanelLayout(){
 const mobile=ref(matchMedia('(max-width:760px)').matches)
 const leftOpen=ref(!mobile.value),rightOpen=ref(!mobile.value),leftWidth=ref(244),rightWidth=ref(326)
 const media=matchMedia('(max-width:760px)')
 function responsive(e:MediaQueryListEvent){mobile.value=e.matches;leftOpen.value=!e.matches;rightOpen.value=!e.matches}
 onMounted(()=>media.addEventListener('change',responsive));onBeforeUnmount(()=>media.removeEventListener('change',responsive))
 function toggleLeft(){leftOpen.value=!leftOpen.value;if(mobile.value&&leftOpen.value)rightOpen.value=false}
 function toggleRight(){rightOpen.value=!rightOpen.value;if(mobile.value&&rightOpen.value)leftOpen.value=false}
 const clamp=(side:Side,n:number)=>Math.max(side==='left'?180:240,Math.min(side==='left'?400:460,n))
 try{const raw=JSON.parse(localStorage.getItem('motion-lab-panels-v1')||'null');if(raw){if(typeof raw.left==='number'&&Number.isFinite(raw.left))leftWidth.value=clamp('left',raw.left);if(typeof raw.right==='number'&&Number.isFinite(raw.right))rightWidth.value=clamp('right',raw.right)}}catch{}
 watch([leftWidth,rightWidth],()=>{try{localStorage.setItem('motion-lab-panels-v1',JSON.stringify({left:leftWidth.value,right:rightWidth.value}))}catch{}},{flush:'post'})
 let drag:{side:Side;id:number;start:number;width:number}|null=null
 const target=(side:Side)=>side==='left'?leftWidth:rightWidth
 function resizeStart(e:PointerEvent,side:Side){if(e.button!==0)return;drag={side,id:e.pointerId,start:e.clientX,width:target(side).value};try{(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)}catch{/* synthetic or released pointer */}}
 function resizeMove(e:PointerEvent){if(!drag||drag.id!==e.pointerId)return;target(drag.side).value=clamp(drag.side,drag.width+(e.clientX-drag.start)*(drag.side==='left'?1:-1))}
 function resizeEnd(e:PointerEvent){if(drag?.id===e.pointerId)drag=null}
 function resizeKey(e:KeyboardEvent,side:Side){if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();target(side).value=clamp(side,target(side).value+(e.key==='ArrowRight'?10:-10)*(side==='left'?1:-1))}
 return {mobile,leftOpen,rightOpen,leftWidth,rightWidth,resizeStart,resizeMove,resizeEnd,resizeKey,toggleLeft,toggleRight}
}
