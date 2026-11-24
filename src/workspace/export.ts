import { easingOf, isTimeline, keyframes, type Config } from './model'
export type Format = 'Vue'|'React'|'JavaScript'|'CSS'|'Tokens'|'AI'
export function codeFor(c:Config,format:Format):string {
  const frames=JSON.stringify(keyframes(c),null,2), opts=JSON.stringify({duration:c.duration,easing:easingOf(c),fill:'both'})
  const tokens=JSON.stringify({motion:{duration:c.duration,easing:easingOf(c),distance:c.distance,bounce:c.bounce,stagger:c.stagger}},null,2)
  const reduced="matchMedia('(prefers-reduced-motion: reduce)').matches"
  if(format==='Tokens')return tokens
  if(format==='AI')return '实现 '+c.effect+' 动效。遵守减少动态效果、可中断、卸载清理；配置如下：\n'+JSON.stringify(c,null,2)
  if(!isTimeline(c.effect))return '// 此交互依赖运行时布局/指针，不是静态关键帧。\n// 引入 motion-kit 的 '+(c.effect==='flip'?'captureLayout / animateLayout':c.effect==='shared'?'sharedElement':'drag')+' 并按以下配置接入：\n'+JSON.stringify(c,null,2)
  if(format==='CSS'){
    const css=keyframes(c).map(f=>Math.round(Number(f.offset)*10000)/100+'% { transform: '+f.transform+'; '+(f.opacity===undefined?'':'opacity: '+f.opacity+';')+' }').join('\n')
    return '@keyframes motion {\n'+css+'\n}\n.motion { animation: motion '+c.duration+'ms '+easingOf(c)+' both; }\n'+(c.effect==='stagger'?'.motion { animation-delay: calc(var(--index, 0) * '+c.stagger+'ms); }\n':'')+'@media (prefers-reduced-motion: reduce) { .motion { animation: none; } }'
  }
  const animation='const animations = [...elements].map((el,i) => el.animate('+frames+', {...'+opts+', delay: i * '+(c.effect==='stagger'?c.stagger:0)+'}));\nreturn () => animations.forEach(a => a.cancel());'
  const fn='function run(elements) {\nif ('+reduced+') return () => {};\n'+animation+'\n}\n'
  if(format==='Vue')return '<script setup>\nimport { ref, onMounted, onBeforeUnmount } from "vue"\n'+fn+'const root = ref(null); let stop;\nonMounted(() => { stop = run(root.value.children) });\nonBeforeUnmount(() => stop?.());\n<\/script>\n<template><div ref="root"><div>Preview</div></div></template>'
  if(format==='React')return 'import { useEffect, useRef } from "react";\n'+fn+'export default function Motion() { const root = useRef(null); useEffect(() => run(root.current.children), []); return <div ref={root}><div>Preview</div></div>; }'
  return fn+'const stop = run(document.querySelectorAll(".motion")); // call stop() on disposal'
}
