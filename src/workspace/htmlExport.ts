import { codeFor } from './export'
import { isTimeline, type Config } from './model'
import layout from '../../packages/motion/layout.js?raw'
import easing from '../../packages/motion/easing.js?raw'
// Bundle the two dependency-free modules into one classic script, preserving their exported functions.
export function htmlFor(c:Config){
  const js=codeFor(c,'JavaScript').replace(/^import .* from "\.\/motion-kit\/index\.js";$/m,'').replace('export const dispose=','const dispose=')
  const strip=(s:string)=>s.replace(/^import .*\n/gm,'').replace(/^export /gm,'')
  const runtime=isTimeline(c.effect)?'':strip(easing)+'\n'+strip(layout)
  const script=(runtime+'\n'+js).replace(/<\/script/gi,'<\\/script')
  return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Motion Lab Demo</title><style>body{font:16px system-ui;background:#f4f6fa;color:#202936;padding:24px} [data-motion-root]{min-height:200px;align-items:center;justify-content:center;flex-wrap:wrap}button{padding:8px;border:1px solid #bdc8da;border-radius:8px;background:white}</style><h1>Motion Lab · '+c.effect+'</h1><div data-motion-root></div><script type="module">'+script+'<\/script></html>'
}
