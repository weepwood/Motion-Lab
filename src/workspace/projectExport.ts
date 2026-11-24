import {projectTracks,type Project} from './project'
import {zipFiles} from './exportPack'
import runtime from '../../packages/motion/composition.js?raw'
import layout from '../../packages/motion/layout.js?raw'
import easing from '../../packages/motion/easing.js?raw'
const strip=(s:string)=>s.replace(/^import .*\n/gm,'').replace(/^export /gm,'')
const safe=(p:Project)=>JSON.stringify(projectTracks(p)).replace(/</g,'\\u003c')
export function projectHtml(p:Project){
 const script=[strip(easing),strip(layout),strip(runtime),'const player=mountComposition(document.getElementById("stage"),'+safe(p)+');document.getElementById("play").addEventListener("click",player.play);addEventListener("pagehide",player.dispose);player.play()'].join('\n').replace(/<\/script/gi,'<\\/script')
 return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Motion Lab 编排</title><style>body{font:14px system-ui;background:#f5f6f8;color:#242b38;padding:20px}button{padding:8px;margin-bottom:12px}</style><button id="play">播放编排</button><main id="stage"></main><script type="module">'+script+'</script></html>'
}
export function projectCode(p:Project,framework:'Vue'|'React'){
 const data=safe(p)
 if(framework==='Vue')return '<script setup>\nimport {ref,onMounted,onBeforeUnmount} from "vue"\nimport {mountComposition} from "./motion-kit/composition.js"\nconst root=ref(null);let player;onMounted(()=>{player=mountComposition(root.value,'+data+');player.play()});onBeforeUnmount(()=>player?.dispose())\n<\/script>\n<template><button @click="player?.play()">播放编排</button><div ref="root"></div></template>'
 return 'import {useRef,useEffect} from "react"\nimport {mountComposition} from "./motion-kit/composition.js"\nexport default function Composition(){const root=useRef(null),player=useRef(null);useEffect(()=>{player.current=mountComposition(root.current,'+data+');player.current.play();return()=>player.current?.dispose()},[]);return <><button onClick={()=>player.current?.play()}>播放编排</button><div ref={root}/></>}'
}
export function projectZip(p:Project){return zipFiles({'index.html':projectHtml(p),'project.json':JSON.stringify(p,null,2),'Composition.vue':projectCode(p,'Vue'),'Composition.jsx':projectCode(p,'React'),'motion-kit/composition.js':runtime,'motion-kit/layout.js':layout,'motion-kit/easing.js':easing,'README.md':'Open index.html offline. Copy Composition.vue or Composition.jsx and motion-kit into your framework project. Layout tracks measure built-in scene geometry; recorded gestures are timeline samples.'})}
