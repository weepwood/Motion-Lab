/**
 * AI 复刻导出：把 Motion Lab 里调校好的动画效果，翻译成一份可以直接
 * 交给任何 AI（ChatGPT / Claude / Cursor / Vibe…）的「复刻提示词」。
 *
 * 提示词的数值不是写死的样板：全部实时读取三层配置（等级 / 类别覆盖 /
 * 机制参数），所以导出的就是你此刻调出来的手感。每次导出包含：
 *
 *   1. 人类可读的 Markdown 提示词（角色 → 概述 → 精确参数 → 实现步骤
 *      → 数学 → 工程约束 → 验收标准）
 *   2. 机器可读的 JSON 规范附录（AI 喜欢结构化数据，防止散文误读数值）
 */

import { bezierCss } from './motion'
import { durationFor, easingFor, easing, effectiveLevel, settings } from './settings'

export type EffectId =
  | 'send' | 'reaction' | 'ripple' | 'swipe' | 'theme'
  | 'push' | 'chat' | 'enter' | 'menu' | 'delete' | 'levels' | 'scroll'

export type Framework = 'react' | 'vue' | 'svelte' | 'vanilla'
export type ImplStyle = 'waapi' | 'css' | 'motion-lib'

export interface ExportOptions {
  framework: Framework
  style: ImplStyle
}

interface TokenRow { name: string; value: string; note: string }

interface EffectSpec {
  id: EffectId
  title: string
  summary: string
  tokens: TokenRow[]
  steps: string[]
  math: string[]
  acceptance: string[]
}

export const frameworkLabels: Record<Framework, string> = {
  react: 'React（函数组件）',
  vue: 'Vue 3（Composition API）',
  svelte: 'Svelte',
  vanilla: '原生 ES Module（零依赖）'
}

export const styleLabels: Record<ImplStyle, string> = {
  waapi: 'Web Animations API + CSS 变量（零依赖，推荐）',
  css: '纯 CSS（可 CSS 的部分用 CSS，其余用最小 JS）',
  'motion-lib': '动效库（GSAP / framer-motion / motion 等，时长曲线照搬）'
}

/* ------------------------------------------------------------------ 源数据 */

const num = (n: number, unit = 'ms') => `${Math.round(n)}${unit === 'ms' ? ' ms' : ' ' + unit}`.trim()

function effectSpecs(): EffectSpec[] {
  const m = settings.mech
  // heavy 类别在等级 ≤1 时被停用（durationFor 返回 0）：单独取一次，
  // 既用于参数表，也用于判断该走扩圈还是闪白降级分支。
  const rippleMs = durationFor('ripple')
  const rippleFlash = effectiveLevel.value === 1 && settings.animations.ripple && settings.overrides.ripple.duration !== 0
  return [
    {
      id: 'send',
      title: '消息发送飞行（双曲线弧线 + 落位交叉淡出）',
      summary: '发送瞬间在目的地克隆一份当前气泡的快照压在最上层，真气泡隐藏待命；快照用两条互不相同的贝塞尔曲线分别驱动横、纵位移，走出“先甩出后上浮”的弧线；落位后真气泡显影、克隆体交叉淡出，全程一次性完成飞行感。',
      tokens: [
        { name: '飞行时长', value: num(durationFor('send')), note: 'X 与 Y 同总时长，曲线不同' },
        { name: '横向曲线 CURVE_X', value: bezierCss(m.sendCurveX), note: '快出：起步迅速' },
        { name: '纵向曲线 CURVE_Y', value: bezierCss(m.sendCurveY), note: '上抛更缓，与 X 拉开时差即成弧线' },
        { name: '落位淡出 LAND_FADE', value: num(m.sendLandFade), note: '克隆体与真气泡交叉淡出' }
      ],
      steps: [
        '发送时先取输入框（发送起点）与目标气泡各自 getBoundingClientRect；目标气泡随即 visibility:hidden，克隆（cloneNode）一个快照。',
        '克隆快照用 position:fixed 布置在目标矩形处，外部 wrapper 传横向位移，内部克隆体传纵向位移 + 缩放，两个 WAAPI 动画同时播放（fill: both）。',
        '横向动画：wrapper transform 从 translate3d(dx,0,0) → translate3d(0,0,0)，easing 用 CURVE_X。',
        '纵向动画：克隆体 transform 从 translate3d(0,dy,0) scale(s) → 无位移 scale(1)，透明度 0.4 → 1，easing 用 CURVE_Y；s = 起点.高度 / 目标.高度 的比值，clamp(0.82, 1)。',
        '两个动画都结束后：把真气泡 visibility 还原（显影），克隆体透明度 1 → 0 播放 LAND_FADE（ease-out），结束后移除克隆 DOM。',
        '可中断：新一次发送开始前必须取消上一次飞行动画并移除其克隆节点（同一 key 的实例互相替换）。'
      ],
      math: [
        'dx = 源.left − 目标.left（横向总位移）；dy = 源.top + 源.height/2 − (目标.top + 目标.height/2)',
        '弧线由「同时长、不同曲线」合成：CURVE_X 前段走得快、CURVE_Y 前段走得慢 → 路径前段以水平为主、后段爬升弯入，视觉即弧线。'
      ],
      acceptance: [
        '飞行轨迹是一条弧线且淡入落位，肉眼可见两条曲线的时差',
        '飞行进行中再次发送：旧飞行立即取消、无克隆残留（DOM 里搜不到克隆节点）',
        'prefers-reduced-motion 时毫不飞行，消息直接出现',
        '动画期间不引起布局抖动（只动 transform/opacity）'
      ]
    },
    {
      id: 'reaction',
      title: '表情回应（解析抛物线飞行 + 落点弹跳 + 粒子迸发）',
      summary: `从选中的菜单按钮位置放飞一枚 emoji，沿真实二次抛物线（16 站关键帧）飞进目标气泡的回应标签；飞行到 ${Math.round(m.reactionLanding * 100)}% 时落点提前显影并弹跳，落定瞬间爆发一圈小表情粒子。`,
      tokens: [
        { name: '飞行时长', value: num(durationFor('reaction')), note: 'iOS 原版 200ms 过快，实测 300ms 手感更佳' },
        { name: '中程抬升 ELEVATION', value: num(m.reactionElevation, 'px'), note: '路径中点比直线中点高出的像素' },
        { name: '落点显影 LANDING_UNTIL', value: `${Math.round(m.reactionLanding * 100)}%`, note: '飞行过这个比例时目标就开始出现' },
        { name: '落点弹跳', value: num(Math.round(durationFor('reaction') * 0.5)), note: 'scale 0.55 → 1.18 → 1' },
        { name: '粒子时长', value: num(durationFor('particles')), note: '粒子迸发' }
      ],
      steps: [
        '起飞节点：一个 span 放 emoji，position:fixed 定位在目标中心，所有位移都靠 transform。',
        '横向位移用线性插值 dx·t（注意 easing 用 linear——曲线已烘焙进关键帧），缩放从 1.6 → 1。',
        '纵向位移用抛物线（见数学），采样 16 站生成关键帧数组交给 WAAPI。',
        '起一个 setTimeout(飞行时长 × LANDING_UNTIL)：到点时目标回应标签显影并播放弹跳（scale 0.55 → 1.18(offset .5) → 1）。',
        '飞行结束时移除起飞节点；弹跳开始时迸发粒子：7 个同 emoji，角度 = 2π·i/7 − π/2，距离 34 + (i%3)×10 px，曲线 cubic-bezier(.2,.8,.2,1)，透明度 1 → 0，结束后移除。'
      ],
      math: [
        '抛物线 y(t) = y0 + b·t + a·t²  经过 (0,y0) 与 (1,0)，且中点 y(0.5) = yMid',
        'yMid = y0/2 − ELEVATION；b = 4·(yMid − y0) − (0 − y0)；a = (0 − y0) − b',
        'y0 = 源中心.y − 目标中心.y（起飞高度差，含正负号直接代入）'
      ],
      acceptance: [
        '轨迹是光滑抛物线，中段明显抬升',
        '落点在飞行未结束前就开始弹跳（提前显影可观察）',
        '粒子落在反应标签周围呈放射状迸发，动画结束后无节点残留',
        '重复点击同一目标：前一次飞行被取消，无双影'
      ]
    },
    {
      id: 'ripple',
      title: '按下涟漪（最远角半径 + 指数淡出）',
      summary: '按下的位置为中心生成一个圆形波纹，半径取「按下点到控件最远角」的距离，因此一波就能盖满整个控件；松手后波纹在剩余时长的 1/2 内淡出。触屏移动超过 8px 视为滚动，涟漪立即放弃。',
      tokens: [
        {
          name: '波纹时长',
          value: num(rippleMs),
          note: rippleMs === 0
            ? (rippleFlash ? '当前等级 ≤1（heavy 效果停用）：等级 1 保留 120ms 闪白降级分支' : '已关闭：不生成波纹节点')
            : '在运行时从 CSS 变量读回，保证 JS/CSS 单源'
        },
        { name: '波纹曲线', value: easingFor('ripple'), note: '' },
        { name: '降级闪白 FLASH', value: '120 ms', note: '等级 1（且涟漪启用）：不扩圈，opacity 0 → 1 的闪白；松手淡出 60 ms' },
        { name: '起始 scale', value: String(m.rippleStart), note: '触屏指针取 ≥0.27 起步，视觉上更跟手' },
        { name: '结束 scale', value: String(m.rippleEnd), note: '结束时刻恰好盖满最远角' }
      ],
      steps: [
        'pointerdown 时在控件内部建一个裁剪层（overflow:hidden + border-radius:inherit），波纹节点 absolute 放入。',
        '波纹直径 = 2 × 半径，left/top = 按下点 − 半径',
        'WAAPI 播放 transform: scale(起始) → scale(结束)，fill: forwards；easing 从 CSS 变量读取。',
        'pointerup：计算已经过时间 elapsed，淡出时长 = 总时长/2，若 elapsed + 淡出 > 总时长则立即开始淡出，否则延迟 总时长 − elapsed − 淡出 后开始；淡出用 ease-out，结束后移除节点。',
        '等级 1 降级（tweb animation-level 语义：减弱而非删除）：不扩圈，波纹固定 scale(结束值)，只播 opacity 0 → 1 的 120ms 闪白，松手淡出只有 60ms。',
        '等级 0、涟漪关闭或时长 0：不创建节点；触屏 pointermove 与按下点距离 > 8px 即立刻清理（把机会让给滚动）。',
        '注意控件若 position 为 static 需临时置 relative；裁剪层波及不到控件外部。'
      ],
      math: [
        '半径 r = √( max(|x − w/2| + w/2, 0)² + (|y − h/2| + h/2)² ) ≡ √( farthestX² + farthestY² )',
        'farthestX = max(x, w − x)，farthestY = max(y, h − y)（按下点到最远角的距离）'
      ],
      acceptance: [
        '无论点在控件的哪个角落，波纹都能盖满整个控件',
        '短按：波纹存活完整时长后淡出；长按：松手后 1/2 时长内淡出',
        '等级 1（启用时）表现为 120ms 闪白（不扩圈），松手 60ms 内消失',
        '触屏按住后往上滑动：波纹立即消失，页面正常滚动',
        '同一控件连点多次：多波共存互不干扰，节点最终全部回收'
      ]
    },
    {
      id: 'swipe',
      title: '滑动回复手势（锁轴 + 阻尼跟手 + 比例阈值）',
      summary: '列表项可以按住向左拖动，“回复”图标随进度显影；跟手位移有阻尼封顶，拖过阈值即震动 + 触发回调，松手回弹。',
      tokens: [
        { name: '最大跟手位移 MAX', value: num(m.swipeMax, 'px'), note: '1:1 跟手的上限' },
        { name: '触发阈值', value: num(m.swipeMax * m.swipeTrigger, 'px'), note: `= MAX × ${m.swipeTrigger}` },
        { name: '回弹时长/曲线', value: `${num(durationFor('sidebar'))} / ${easingFor('sidebar')}`, note: '松手回弹动画' }
      ],
      steps: [
        'pointerdown 记录起点，进入 pending；移动量 <8px 时不表态（避免首帧抖动）。',
        '锁轴：一旦 |Δy| > 20px 立即放弃这个手势（让位垂直滚动）；一旦 |Δx| > |Δy| 则永久锁定横轴，并 setPointerCapture。',
        '跟手：位移 = min(拉动量, MAX)；超出 MAX 的部分只乘 0.25（阻尼），最终再夹在 MAX+48px 内。',
        '进度 = 当前位移 / 触发阈值，用作回复图标的透明度和 scale（0.4 + 进度×0.6）。',
        '跨过阈值那一帧触发一次轻震动（vibrate(8)，可选）；回退到阈值下视为反悔。',
        '松手：播放回弹动画（从当前位移 → 0），若达到阈值则执行 onTrigger（例：把该消息置为回复对象）。'
      ],
      math: [
        '位移 d = p ≤ MAX ? p : MAX + (p − MAX) × 0.25，再 min(d, MAX + 48)',
        '阈值 T = MAX × 触发比例（0.75 → 48px 的手感）'
      ],
      acceptance: [
        '左右满拖手感：跟手到 MAX 后明显变重（阻尼可感知但不生硬）',
        '往上下滚动列表正常，绝不误触发滑动回复',
        '图标显影随进度连续，松手回弹无跳变；触发后对应 UI 回调收到目标引用'
      ]
    },
    {
      id: 'theme',
      title: '主题圆形揭示（View Transitions，无颜色插值）',
      summary: '切换日间/夜间主题时不做任何颜色过渡——主题变量瞬时切换，“过渡感”全靠 View Transitions 快照上的一段以点击点为圆心的圆形揭示。',
      tokens: [
        { name: '揭示时长（进夜）', value: num(durationFor('themeReveal')), note: '出夜 ×0.83（tweb 600/500 关系）' },
        { name: '揭示曲线', value: easingFor('themeReveal'), note: '打在 ::view-transition-new(root) 伪元素上' }
      ],
      steps: [
        '整个切换包进 document.startViewTransition(() => { 变更主题类/变量 })，颜色在回调里瞬时落地。',
        '等待 transition.ready；之后在 document.documentElement.animate 上播放 clipPath 关键帧，pseudoElement 指定为 \'::view-transition-new(root)\'。',
        '关键帧从 circle(0px at x y) 到 circle(Rpx at x y)，R 见数学。',
        '全局 CSS 需要 ::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal } 关掉默认交叉淡，揭示才不会叠味。',
        '降级：不支持 View Transitions 的浏览器直接执行主题回调；动画被打断（页面隐藏等）也要保证回调已执行。'
      ],
      math: [
        'R = √( max(x, W − x)² + max(y, H − y)² )：点击点到视口最远角的距离（W、H 为视口尺寸）',
        '出夜时长 = 进夜 × 0.83（500/600 的官方关系，可作为常量）'
      ],
      acceptance: [
        '从按钮点下的位置看到新主题圆形扩散铺满全屏 ≥ 屏幕对角线方向',
        '切换期间无默认交叉淡效果，无颜色插值带来的中间灰',
        'prefers-reduced-motion：直接切换无动画',
        '不支持 API 的环境功能完好（渐进增强）'
      ]
    },
    {
      id: 'push',
      title: '列推挤导航（新页整宽推入，旧页视差压暗）',
      summary: `主从导航转场：新页面从右整宽滑入压上来，旧页面不是瞬移消失，而是退开 ${m.navParallax}% 视差并压暗到 ${m.navDim}% 亮度，暗示层级关系（tweb slideNavigation）。`,
      tokens: [
        { name: '推入时长', value: num(durationFor('sidebar')), note: '' },
        { name: '推入曲线', value: easingFor('sidebar'), note: '' },
        { name: '旧页视差', value: `${m.navParallax}%`, note: '旧页滑出的比例（两种拖拽方向的语义由导航方向决定）' },
        { name: '旧页亮度', value: `${m.navDim}%`, note: 'brightness() 滤镜' }
      ],
      steps: [
        '结构上两个页面绝对定位在同一容器里；进入页 z-index 更高并加投影分隔。',
        '进入页 transform: translate3d(100%,0,0) → none；旧页 transform → translate3d(-视差%,0,0) 且 filter: brightness(亮度)。',
        '两个页面的 transform/filter 都用 CSS transition，时长/曲线用同一组 CSS 变量 token（便于全局调校）。',
        '返回（pop）时动画反转：退场页滑出 100%，恢复页从视差处归位、亮度复原。',
        '注意 filter 会创建合成层：旧页在动画期间加 will-change/现有层即可，动画结束必须移除（避免常驻内存）。',
        '降级：动画等级 1 时位移 token 置 0 —— 旧页瞬移到位、只剩淡入淡出照常。'
      ],
      math: [
        '视差量 = 容器宽 × 视差%；两页共享同一条时长/曲线，视觉上必需完全同步'
      ],
      acceptance: [
        '推入时能看到旧页退开 + 压暗的层次感（不是简单的滑盖）',
        '进入/返回往返流畅，两页动画不串帧',
        '动画只在 transform/filter/opacity 上，帧稳（>45fps 桌面）'
      ]
    },
    {
      id: 'chat',
      title: '会话切换横滑（方向感知 + 渐隐）',
      summary: '列表切到另一会话时，旧聊天区朝切换方向淡出，新聊天区从同方向 40px 处浮入——进退同向，让用户记住“往哪个方向翻了一页”；方向由两个会话在列表里的索引先后决定。',
      tokens: [
        { name: '转场时长', value: num(durationFor('chat')), note: '' },
        { name: '转场曲线', value: easingFor('chat'), note: '位移与淡入同长' }
      ],
      steps: [
        '计算 from/to 会话在排序列表中的索引，toIndex > fromIndex 则向左滚动（next），否则 prev。',
        '进入页 translate3d(±40px,0,0) + opacity 0 → 归位；离开页 → translate3d(∓40px,0,0) + opacity 0。',
        '离开页设 pointer-events:none 防止双列表抢指针。',
        '同一容器切换时也要取消 “正在飞行中的消息克隆、滚动等” 相关动画（同 key 打断或直接 cancel）。'
      ],
      math: [
        '40px 是量出的“小距离”阈值：够给方向感、又不会显眼到像动画'
      ],
      acceptance: [
        '从列表点上下方向的会话，切换方向始终与列表顺序一致',
        '切换连续触发 12 次以上无层叠、无动画叠加抖动',
        '动画期间两页都不响应点击，结束恢复'
      ]
    },
    {
      id: 'enter',
      title: '消息入场（上浮 + 渐显，move/fade token 分离）',
      summary: '收到的新消息从下方 18px 处上浮缩放到 1，同时淡入；淡入时长只有位移的 0.6，是为了“先看得到、再站稳”。',
      tokens: [
        { name: '位移时长/曲线', value: `${num(durationFor('incoming'))} / ${easingFor('incoming')}`, note: '同 CSS 变量 --dur-incoming (-move)' },
        { name: '淡入时长', value: num(durationFor('incoming') * 0.6), note: '位移的 0.6 倍（比例参数）' },
        { name: '位移量', value: 'translate3d(0, 18px, 0) scale(.94)', note: '从底部浮起并轻微放大' }
      ],
      steps: [
        '列表渲染时新项挂上 enter 类：初始 transform 上移 18px + scale(0.94)，opacity 0。',
        '过渡定义一次：transform 用「位移时长 + 位移曲线」，opacity 单独用「位移×0.6 + ease-out」；两对参数分开写。',
        '动画结束移除初始类。（推荐 Vue Transition 或进入/离开钩子；纯 JS 用 WAAPI。）',
        '等级 1 降级：位移时长 token 为 0，淡入照常 —— 消息「闪现」而非「浮上」；等级 0 两类都为 0。'
      ],
      math: [
        '18px ≈ 行高的 40%，约 1 条气泡文案的 1 行——大于它认为“内容搬运”，小于它没有印象'
      ],
      acceptance: [
        '入场快捷轻快，不带动列表中其他条目',
        '等级 1（reduced 模式）时透明度仍渐显，位移消失（这是盲用 prefers-reduced-motion 的正确姿势）'
      ]
    },
    {
      id: 'menu',
      title: '上下文菜单（指针定位 + 锚点缩放开合）',
      summary: '右键/长按弹出菜单：菜单宽 256px，优先出现在指针右下角，出屏就翻到左/上侧；展开动画从指针实际命中点为 transform-origin 缩放 0.85 → 1，收起用更短的 0.7 倍 ease-in。',
      tokens: [
        { name: '展开时长/曲线', value: `${num(durationFor('menu'))} / ${easingFor('menu')}`, note: 'tweb 实测 .2s 标准曲线' },
        { name: '收起时长', value: num(durationFor('menu') * 0.7), note: '0.7 倍 + ease-in（收得快是礼貌）' },
        { name: '展开比例', value: 'scale(0.85) → scale(1)', note: '不改尺寸，避免文字抖动' }
      ],
      steps: [
        '点击捕捉 clientX/Y；用固定常量 256×232 作为菜单尺寸（无需测量，实测 Telegram 就是这个尺寸）：左侧 = x + 256 + 8 > 视口宽 ? x − 256 : x，顶部同理，再与 8px 安全边距 clamp。',
        'transform-origin 取指针在菜单内的命中坐标：origin = (指针x − 菜单left)px (指针y − 菜单top)px。',
        '出现：opacity 0 + scale(.85) → 1；离开：展开时长×0.7 的 ease-in 反向。收尾用 scale3d(1,1,1) 而不是 scale(1)，可避免某些引擎下的文字抖动。',
        '256px 宽是 Telegram 的实测值，不要随意改动；触屏长按 400–480ms 触发，可配合 vibrate(8) 反馈。',
        '关闭：Esc / 点击菜单外任意处 / 点完一项即静默关闭；关闭后焦点如可回归原触发器更佳。'
      ],
      math: [
        'origin 的 clamp：ox = min(max(0, x − menuLeft), menuWidth)，确保原点不会跨出菜单'
      ],
      acceptance: [
        '在视口四角处右键均能完整显示菜单且不裁切',
        '展开的缩放原点正是指针命中点（不是中心）',
        'Esc 及外点关闭且无误触发别的逻辑'
      ]
    },
    {
      id: 'delete',
      title: '删除消息（高度收起 + 淡出）',
      summary: '从列表删除一条消息：把该行高度动画到 0、margin 归零并淡出下沉（这不是纯合成动画，需要主动补偿以避免下方抖动，脚本必须引用真实布局值）。',
      tokens: [
        { name: '收起时长/曲线', value: `${num(durationFor('incoming'))} / ${easingFor('incoming')}`, note: '' },
        { name: '关键帧', value: 'height → 0, margin-top → 0, opacity → 0, scale(.9)', note: '四属性同帧结束' }
      ],
      steps: [
        '离开开始前先取 offsetHeight 与 getComputedStyle().marginTop 作为起始关键帧（动画值取快照，避免中途变化）。',
        '节点 overflow:hidden 后播放关键帧：height item.h → 0；marginTop mt → 0；opacity 1 → 0；transform → scale(.9)。',
        '动画结束节点出 DOM 列表；期间列表下方内容平滑上移（这正是高度动画存在的目的——视觉连续性优先）。',
        '等级 1：不做高度动画，只淡出（高度是逐帧布局动画，代价最大，reduced 时跳过是正确的）。',
        '动画目标如被外层 React/Vue 列表 re-render 撤回，必须在 cleanup 中强制完成或取消动画（框架钩子）。'
      ],
      math: [
        '没有公式，但记住约束：这是整页唯一允许的非合成动画，仅用于“别无选择”的行为持续性'
      ],
      acceptance: [
        '上滑收起连续不闪跳，列表其余条目视口稳定',
        '删除后条目与关联内存均清理，反复删除无堆积'
      ]
    },
    {
      id: 'levels',
      title: '三级动画等级系统（位移/淡入 token 分离）',
      summary: '把“减弱动画”做成三档而不是二开关；2 = 完整、1 = 位移瞬跳但淡入淡出照常、0 = 全关。实现关键是把每条 transition 的时长拆成两个 CSS 变量引用：--dur-*（淡入/颜色，如 --dur-send）和 --dur-*-move（transform 位移，如 --dur-incoming-move），等级 1 只把 -move 置 0。',
      tokens: [
        { name: '基础时长', value: num(settings.duration), note: '所有类别的基准' },
        { name: '全局曲线', value: easing.value, note: '类别可逐个覆盖' },
        { name: '位移 token 规则', value: '--dur-* 保留；--dur-*-move 置 0', note: '等级 1 的核心规则' }
      ],
      steps: [
        '每条可能位移的 transition 都写成两段：transform 用 var(--dur-x-move)，opacity/color 用 var(--dur-x)。',
        '在 <html> 或根元素挂 data-motion-level="0|1|2"；用 attribute selector 写 token：[data-motion-level="1"] 内 --dur-*-move: 0ms，[data-motion-level="0"] 全部 0ms。',
        '常量【省电/低电量】等外部条件映射为“取 min(用户等级, 环境允许等级)”；UI 需展示生效级别并说明原因。',
        'prefers-reduced-motion: reduce 默认强制 0 级（留 [data-motion-keep] 作为单例逃生口）。',
        '时长单源但各有分工：CSS 侧由 token 驱动 transition；需要 WAAPI 的部分（飞行/抛物线/弹跳）在 JS 里用同一份配置算时长后交给 animate()；只有涟漪把 --mk-ripple-duration / --mk-ripple-easing 读回来，做到 CSS/JS 完全同步。'
      ],
      math: [
        '生命周期 token 化：位移 token 与淡入 token 分离，就能用 CSS 单变量切换全局降级语义，不需要碰任何一条 transition'
      ],
      acceptance: [
        '等级 1：所有 translate/scale 类瞬跳，透明度和颜色仍渐变；等级 0 完全即点即达',
        '系统偏好与用户设置三态组合均有正确生效结果',
        '设置 UI 显示当前生效级别并注明原因（谁都看得懂为什么被降级）'
      ]
    },
    {
      id: 'scroll',
      title: '滚动锚点补偿（列表变化时视口钉住）',
      summary: `任何在滚动列表“顶部”插入内容（加载历史、前置插入）会被浏览器视为滚动，而视觉上会跳一下；锚点补偿用一行 scrollTop 差值恢复视口位置。${m.scrollAnchor ? '' : '（本项目当前已关闭锚点补偿，下面是参照实现，落地时请自行决定是否接管浏览器的原生 scroll anchoring。）'}`,
      tokens: [
        { name: '判定重算阈值', value: '0.5px', note: '差值小于它视为静止' },
        { name: '锚点选择', value: '第一条与可视区相交的行（高度 > 0）', note: '被顶部裁掉一半的行也会入选——宁可锚住残缺行，也不要跳一下' },
        { name: '锚点补偿开关', value: m.scrollAnchor ? '开启（由本实现接管）' : '关闭（交给浏览器原生 scroll anchoring）', note: '仅本项目有这个开关；移植时按目标项目的策略选' }
      ],
      steps: [
        '在 DOM 变化前：找第一条与可视区相交的行（rect.height > 0 && rect.bottom ≥ 视口.top && rect.top ≤ 视口.bottom），记下它的标识 + (row.top − 视口.top) 位移。',
        'DOM 变化完成后：重新查这行的新位置，recentDelta = 新位移 − 记录位移；把 scroller.scrollTop += recentDelta。',
        '可选：在路由/标签切换/窗口尺寸变化后重新锚定，scrollTop 松散（容器 resize 抖动也顺畅）。',
        '若锚点行已不存在（被替换）则跳过补偿，不防碍。'
      ],
      math: [
        'Δ = (row.top − box.top)after − (row.top − box.top)before；scroller.scrollTop += Δ；|Δ| < 0.5px 时跳过'
      ],
      acceptance: [
        '在滚动中途点“加载更早”后视口原行永远不动（肉眼看不出发生过插入）',
        'DOM 变化从同步到异步均能补偿（再嵌一层 requestAnimationFrame 亦可）；无回滚跳动'
      ]
    }
  ]
}

/* ---------------------------------------------------------------- 组装器 */

const engineering = (framework: Framework, style: ImplStyle): string[] => {
  const notes: string[] = [
    '**只允许动画 transform / opacity**（唯一例外是显式标注了「高度收起」的行为连续性动画），禁止每帧驱动 top/left/width/height 布局属性。',
    '**所有飞行/粒子/波纹用 Web Animations API（element.animate）**，fill 用 both/forwards；不依赖任何外部库即可运行。',
    '**可中断是一级公民**：同一目标的新动画开始前必须取消旧动画并清理其临时 DOM 节点（克隆体/波纹/粒子），不允许两个动画叠加。',
    '**尊重系统偏好**：prefers-reduced-motion: reduce 时所有位移类动画不播放（内容直接落位），淡入淡出也缩短或关闭；不要用 JS 撤销用户系统设置。',
    '**性能自证**：60fps 目标，动画节点加 will-change: transform 且动画结束后必须移除该属性或删除节点；禁止在动画期间读取布局（layout thrash）。',
    '**实现完整后自查**：反复触发 20 次、切换页面/组件卸载、快速连点，动画既不叠加也不留泄漏节点。'
  ]
  if (style === 'waapi') notes.push('优先零依赖：WAAPI + CSS 变量 token 就够了，不需要引入动效库。')
  if (style === 'css') notes.push('能用 CSS transition 的状态过渡用 CSS；只有需要逐帧计算的（拖拽、飞行曲线）才落 JS。')
  if (style === 'motion-lib') notes.push('若使用动效库（GSAP / framer-motion / motion），时长与曲线 token *必须照搬本规范的数值*，库只应是执行手段而不是它默认样式的载体。')
  const fw: Record<Framework, string> = {
    react: '**React 特定要求**：动画对象保存在 useRef 而不是 state；useEffect cleanup 必须取消动画+移除克隆节点；列表删除用离开钩子或一等库处理出场动画。',
    vue: '**Vue 特定要求**：DOM 级操作推荐自定义指令或模板 ref；unmounted 钩子里做同款清理；列表过渡用 <TransitionGroup> 而不是 v-if。',
    svelte: '**Svelte 特定要求**：用 use:action 封装（挂载/卸载生命周期对称）；过渡用 in/out: 指令或过渡事件钩子。',
    vanilla: '**原生要求**：ESM 导出函数 + 返回 detach/cleanup；同一页面可以挂多个实例互不干扰。'
  }
  notes.push(fw[framework])
  return notes
}

const indent = (s: string, pad = '  ') => s.split('\n').map(l => pad + l).join('\n')

/** 机器可读规范（附在提示词末尾，AI 不会误读数值） */
function machineSpec(spec: EffectSpec, opts: ExportOptions): string {
  return JSON.stringify({
    effect: spec.id,
    title: spec.title,
    origin: 'Motion Lab · tweb 动效研究 · 独立实现',
    target: { framework: opts.framework, style: opts.style },
    tokens: Object.fromEntries(spec.tokens.map(t => [t.name, t.value])),
    mechanism: spec.steps,
    math: spec.math,
    engineering: ['transform/opacity only', 'interruptible, keyed', 'respects prefers-reduced-motion'],
    acceptance: spec.acceptance
  }, null, 2)
}

/** 单个效果的完整复刻提示词。 */
export function buildEffectPrompt(id: EffectId, opts: ExportOptions): string {
  const spec = effectSpecs().find(s => s.id === id) as EffectSpec
  const tokenTable = spec.tokens.map(t => `| ${t.name} | \`${t.value}\` | ${t.note} |`).join('\n')
  const steps = spec.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
  const math = spec.math.map(s => `- ${s}`).join('\n')
  const eng = engineering(opts.framework, opts.style).map(s => `- ${s}`).join('\n')
  const acc = spec.acceptance.map(s => `- ${s}`).join('\n')
  return `# 动效复刻任务：${spec.title}

> 你是一名资深 Web 动效工程师。请在**${frameworkLabels[opts.framework]}**项目中，以**${styleLabels[opts.style]}**实现下面这份动效规范。其中所有数值取自真实浏览器里的已调校配置，**请原样使用，不要自行改动**；规范没写的细节按你最好的工程直觉补全。

## 效果概述

${spec.summary}

## 精确参数（照抄）

| 参数 | 值 | 说明 |
| --- | --- | --- |
${tokenTable}

全局基准：基础时长 ${settings.duration} ms，全局曲线 ${easing.value}（规范未指定曲线处一律用它）。

## 实现步骤（机制拆解）

${steps}

## 数学与几何公式

${math}

## 工程与兼容性要求（必须满足）

${eng}

## 验收标准（对照自检）

${acc}

## 机器可读规范（附录，防止散文误读）

\`\`\`json
${indent(machineSpec(spec, opts))}
\`\`\`

背景：该动效是对开源项目 tweb（Telegram Web）的独立研究重实现，机制与数值均来自源码实测与浏览器调校。实现语言用目标项目的语言，不要创建额外依赖。
`
}

/** 全套效果的「动效系统总览」提示词（一次交给 AI，配套引用单个效果）。 */
export function buildSystemPrompt(opts: ExportOptions): string {
  const specs = effectSpecs()
  const index = specs.map((s, i) => `${i + 1}. **${s.title}** —— ${s.tokens.map(t => t.value).slice(0, 3).join(' / ')}`).join('\n')
  const bodies = specs.map(s => buildEffectPrompt(s.id, opts)).join('\n\n---\n\n')
  return `# 动效系统总览：Motion Lab 全套动画复刻

> 下面是 ${specs.length} 个动效的整体索引与各自的完整复刻规范。可以一次全部实现，也可以让 AI 先实现其中任何一项（每个小节自含，直接粘贴对应小节即可）。

## 索引

${index}

## 全局工程要求（所有效果共用）

${engineering(opts.framework, opts.style).map(s => '- ' + s).join('\n')}

${bodies}
`
}

export interface ExportableEffect {
  id: EffectId
  title: string
}

/** 设置页的效果清单（含 Vue 侧展示用标题）。 */
export function exportableEffects(): ExportableEffect[] {
  return effectSpecs().map(s => ({ id: s.id, title: s.title }))
}

/** Read-only view of the same live spec used by prompt generation. */
export function exportEffectDetails(id:EffectId):EffectSpec {return effectSpecs().find(s=>s.id===id)!}
