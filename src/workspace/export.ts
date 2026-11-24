import { easingOf, isTimeline, keyframes, type Config } from './model'
export type Format = 'Vue'|'React'|'JavaScript'|'CSS'|'Tokens'|'AI'
const library = './motion-kit/index.js'
const extensions: Record<Format,string>={Vue:'vue',React:'jsx',JavaScript:'js',CSS:'css',Tokens:'json',AI:'md'}
export const extensionFor=(format:Format)=>extensions[format]
function interactionBody(c:Config){
  const opts=JSON.stringify({duration:c.duration,easing:easingOf(c)})
  return `// Copy packages/motion to ./motion-kit, or change the import path.
import { captureLayout, animateLayout, cancelLayout, drag, play } from "${library}";
function mountMotion(root) {
  const options = ${opts};
  const effect = ${JSON.stringify(c.effect)};
  const previousTouch = root.style.touchAction;
  const previousDisplay = root.style.display;
  const previousGap = root.style.gap;
  root.style.display = "flex"; root.style.gap = "12px";
  const button = document.createElement("button");
  button.type = "button"; button.textContent = "运行布局转场";
  const items = Array.from({length: effect === "flip" ? 4 : 1}, (_, i) => {
    const el = document.createElement("div");
    el.textContent = effect === "drag" ? "拖动" : String(i+1);
    Object.assign(el.style,{width:"64px",height:"64px",background:"#729cea",borderRadius:"12px",display:"grid",placeItems:"center",touchAction:"none",userSelect:"none"});
    el.dataset.motionItem = "";
    root.append(el); return el;
  });
  let expanded = false, detach, returning = null;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  function run() {
    const first = captureLayout(items);
    if(effect === "flip") {
      const el = items.shift(); items.push(el); root.insertBefore(el,button);
    } else {
      expanded = !expanded;
      items[0].style.width = expanded ? "128px" : "64px";
      items[0].style.height = expanded ? "128px" : "64px";
    }
    animateLayout(first,options);
  }
  if(effect === "drag") {
    const el = items[0]; let x=0,y=0;
    detach = drag(el,{
      onStart: () => { returning?.cancel(); x=0; y=0; },
      onUpdate: p => {x=p.dx;y=p.dy;el.style.transform="translate("+x+"px,"+y+"px)"},
      onEnd: () => { el.style.transform=""; if(!reduced()) returning=play(el,[{transform:"translate("+x+"px,"+y+"px)"},{transform:"none"}],options.duration,options.easing); }
    });
  } else { root.append(button); button.addEventListener("click",run); }
  return () => {
    detach?.(); returning?.cancel(); cancelLayout(items);
    button.removeEventListener("click",run); button.remove();
    items.forEach(el=>el.remove()); root.style.touchAction=previousTouch;
    root.style.display=previousDisplay; root.style.gap=previousGap;
  };
}
`
}
function staticBody(c:Config){
  const frames=JSON.stringify(keyframes(c),null,2),opts=JSON.stringify({duration:c.duration,easing:easingOf(c),fill:'both'})
  return `function mountMotion(root) {
  const items = Array.from({length:${c.effect==='stagger'?4:1}}, (_,i)=>{
    const el=document.createElement("div");el.textContent=String(i+1);
    Object.assign(el.style,{width:"64px",height:"64px",background:"#729cea",borderRadius:"12px",display:"inline-grid",placeItems:"center",margin:"6px"});
    root.append(el);return el;
  });
  const animations=matchMedia("(prefers-reduced-motion: reduce)").matches?[]:items.map((el,i)=>el.animate(${frames},{...${opts},delay:i*${c.effect==='stagger'?c.stagger:0}}));
  return ()=>{animations.forEach(a=>a.cancel());items.forEach(el=>el.remove());};
}
`
}
export function codeFor(c:Config,format:Format):string {
  const tokens=JSON.stringify({motion:{duration:{$type:'duration',$value:c.duration+'ms'},easing:{$type:'string',$value:easingOf(c)},distance:{$type:'dimension',$value:c.distance+'px'},bounce:{$type:'number',$value:c.bounce},stagger:{$type:'duration',$value:c.stagger+'ms'}}},null,2)
  if(format==='Tokens')return tokens
  if(format==='AI')return '# 动效实现任务：'+c.effect+'\n\n使用 Motion Kit 或 WAAPI。真实布局：读取起始几何 → 修改 DOM → FLIP；拖拽：指针捕获、取消/释放、归位。静态效果按关键帧播放。尊重系统减动效，连续交互可打断，卸载清理。验收：无残留动画、无重复监听、起止位置正确。\n\n配置：\n'+JSON.stringify(c,null,2)
  if(format==='CSS'){
    if(!isTimeline(c.effect))return '/* CSS 仅提供布局和拖拽样式；几何测量与指针事件请使用 JavaScript 导出。 */\n.motion-root { display:flex; gap:12px; }\n.motion-item { width:64px; height:64px; border-radius:12px; background:#729cea; touch-action:none; user-select:none; }\n:root { --motion-duration: '+c.duration+'ms; --motion-ease: '+easingOf(c)+'; }\n@media (prefers-reduced-motion: reduce) { :root { --motion-duration: 0ms; } }'
    const css=keyframes(c).map(f=>Math.round(Number(f.offset)*10000)/100+'% { transform: '+f.transform+'; '+(f.opacity===undefined?'':'opacity: '+f.opacity+';')+' }').join('\n')
    return '@keyframes motion {\n'+css+'\n}\n.motion { animation: motion '+c.duration+'ms '+easingOf(c)+' both; }\n'+(c.effect==='stagger'?'.motion { animation-delay: calc(var(--index, 0) * '+c.stagger+'ms); }\n':'')+'@media (prefers-reduced-motion: reduce) { .motion { animation: none; } }'
  }
  const body=isTimeline(c.effect)?staticBody(c):interactionBody(c)
  if(format==='Vue')return '<script setup>\nimport { ref, onMounted, onBeforeUnmount } from "vue"\n'+body+'const root=ref(null); let stop;\nonMounted(()=>{stop=mountMotion(root.value)});\nonBeforeUnmount(()=>stop?.());\n<\/script>\n<template><div ref="root"></div></template>'
  if(format==='React')return 'import { useEffect, useRef } from "react";\n'+body+'export default function Motion(){const root=useRef(null);useEffect(()=>mountMotion(root.current),[]);return <div ref={root}/>;}'
  return '// HTML: <div data-motion-root></div> ; load this file as type="module".\n'+body+'const root=document.querySelector("[data-motion-root]");\nif(!root)throw Error("Missing data-motion-root");\nexport const dispose=mountMotion(root);'
}
