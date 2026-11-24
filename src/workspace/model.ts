import { bezierCss, springFrames, physicalSpringFrames, type Bezier } from '../../packages/motion/index.js'
export type Effect = 'slide' | 'spring' | 'fade' | 'scale' | 'stagger' | 'flip' | 'shared' | 'drag'
export type Frame = { offset: number; x: number; y: number; scale: number; opacity: number }
export type Config = { effect: Effect; duration: number; curve: Bezier; bounce: number; distance: number; stagger: number; middle: number; frames: Frame[]; physics?: {mass:number;stiffness:number;damping:number;velocity:number} }
export const catalog: { id: Effect; title: string; category: string; desc: string }[] = [
  { id: 'slide', title: '滑动转场', category: '转场', desc: '带缓动的水平位移' },
  { id: 'fade', title: '淡入淡出', category: '转场', desc: '低干扰透明度过渡' },
  { id: 'scale', title: '缩放入场', category: '微交互', desc: '缩放与透明度组合' },
  { id: 'spring', title: '阻尼弹簧', category: '微交互', desc: '采样物理曲线' },
  { id: 'stagger', title: '级联入场', category: '布局', desc: '多元素顺序入场' },
  { id: 'flip', title: 'FLIP 列表重排', category: '布局', desc: '测量前后几何位置' },
  { id: 'shared', title: '共享元素转场', category: '布局', desc: '同一视觉对象跨容器过渡' },
  { id: 'drag', title: '拖拽与复位', category: '手势', desc: '指针捕获与实时跟手' }
]
export const defaults = (effect: Effect = 'slide'): Config => ({ effect, duration: 320, curve: [.23,1,.32,1], bounce: .3, distance: 110, stagger: 45, middle: .5, frames: [] })
const n = (v: unknown, lo: number, hi: number, d: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d
export function sanitizeConfig(raw: unknown): Config {
  if (!raw || typeof raw !== 'object') throw Error('配置必须为对象')
  const v = raw as Partial<Config>
  if (!catalog.some(item => item.id === v.effect)) throw Error('未知动效类型')
  const d = defaults(v.effect as Effect)
  const curve = Array.isArray(v.curve) && v.curve.length === 4 ? v.curve.map((x,i) => n(x,i%2 ? -1 : 0,i%2 ? 2 : 1,d.curve[i])) as Bezier : d.curve
  const frames = Array.isArray(v.frames) ? v.frames.slice(0, 30).filter(x => x && typeof x === 'object').map(x => ({offset:n(x.offset,0,1,.5),x:n(x.x,-300,300,0),y:n(x.y,-300,300,0),scale:n(x.scale,.1,3,1),opacity:n(x.opacity,0,1,1)})).filter(x => x.offset > 0 && x.offset < 1).sort((a,b)=>a.offset-b.offset).filter((x,i,a)=>!i||x.offset!==a[i-1].offset) : []
  return {effect:d.effect,duration:n(v.duration,0,3000,d.duration),curve,bounce:n(v.bounce,0,.6,d.bounce),distance:n(v.distance,0,240,d.distance),stagger:n(v.stagger,0,200,d.stagger),middle:n(v.middle,.05,.95,d.middle),frames,physics:v.physics&&typeof v.physics==='object'?{mass:n(v.physics.mass,.1,5,1),stiffness:n(v.physics.stiffness,10,800,180),damping:n(v.physics.damping,1,80,18),velocity:n(v.physics.velocity,-2000,2000,0)}:undefined}
}
export const isTimeline = (effect: Effect) => !['flip','shared','drag'].includes(effect)
export function keyframes(c: Config): Keyframe[] {
  if (c.effect === 'spring') return (c.physics?physicalSpringFrames(-c.distance,0,{...c.physics,duration:c.duration}):springFrames(-c.distance,0,c.bounce)).map(f=>({offset:f.offset,transform:'translateX('+f.value+'px)'}))
  const start = {offset:0,x:c.effect==='slide'?-c.distance:0,y:c.effect==='stagger'?c.distance/4:0,scale:c.effect==='scale' ? .65 : 1,opacity:['fade','scale','stagger'].includes(c.effect)?0:1}
  const end = {offset:1,x:0,y:0,scale:1,opacity:1}
  return [start,...c.frames,end].map(f=>({offset:f.offset,transform:'translate('+f.x+'px,'+f.y+'px) scale('+f.scale+')',opacity:f.opacity}))
}
export const easingOf = (c: Config) => c.effect==='spring'?'linear':bezierCss(c.curve)
export const timelineLength = (c: Config) => c.duration+(c.effect==='stagger'?c.stagger*3:0)
export const styles = [
 {name:'macOS · 窗口感',duration:420,curve:[.22,1,.36,1] as Bezier,bounce:.18,source:'Apple HIG Motion',url:'https://developer.apple.com/design/human-interface-guidelines/motion'},
 {name:'iOS · 弹性反馈',duration:380,curve:[.2,.8,.2,1] as Bezier,bounce:.35,source:'SwiftUI spring',url:'https://developer.apple.com/documentation/swiftui/animation/spring'},
 {name:'Linear · 克制响应',duration:180,curve:[.2,.8,.2,1] as Bezier,bounce:.08,source:'Linear design refresh',url:'https://linear.app/now/behind-the-latest-design-refresh'}
]
