# motion-kit

零依赖的 Web 动效工具包。这是 [Motion Lab](../../README.md) 研究的工程化产物：把 tweb（Telegram Web）动效架构里**可在任何项目复用的内核**提取成 8 个 ES Module，纯 JS + DOM 标准，无框架耦合、无构建要求（支持 ESM 的浏览器直接 `import`）。

全部代码为独立实现（MIT），不含 tweb 源代码。

## 安装（拷贝即用）

把整个目录复制进你的项目（或发到你自己的 npm scope）：

```text
packages/motion/
├── index.js         全部导出的入口
├── engine.js        fastRaf 帧合批 + keyed 动画实例（同 key 新动画自动打断旧动画）
├── easing.js        贝塞尔求值/生成、弹簧求解器、play/settle 安全包装、drag
├── flight.js        flyClone 双曲线弧线飞行 + flyParabola 解析抛物线飞行
├── ripple.js        attachRipple 最远角涟漪（等级 1 自动降级为快速淡入）
├── gestures.js      attachSwipe 锁轴 + 阻尼跟手 + 比例阈值（滑动回复数学）
├── scroll-saver.js  createScrollSaver 列表变化时的滚动锚点补偿
├── reveal.js        revealFrom View Transitions 圆形状态揭示
├── tokens.css       设计 token + 动画等级（0/1/2）+ 系统减动效回退
└── index.d.ts       TS 类型（与 JSDoc 同步）
```

```bash
# 方式一：直接拷贝目录（建议固定版本）
cp -r packages/motion your-app/src/lib/motion

# 方式二：作为本地依赖
npm install ../path/to/motion-kit
```

## 快速上手

```js
import { attachRipple, flyParabola, flyClone, attachSwipe, revealFrom } from './lib/motion/index.js'
import './lib/motion/tokens.css'

// 1. 涟漪（任何按钮；时长/曲线默认读 CSS token）
const detach = attachRipple(document.querySelector('.btn'))

// 2. 表情/节点抛物线飞行（落点 75% 时刻提前显影）
await flyParabola({ source: '🔥', target: chipEl, container: rootEl, reveal: () => chipEl.classList.add('on') })

// 3. 双曲线快照飞行（X 快出 / Y 缓升 → 弧线，落位交叉淡出）
await flyClone({ source: cardEl, target: slotEl, container: rootEl, reveal: () => realEl.hidden = false })

// 4. 滑动回复手势（锁轴 + 阻尼 + 阈值）
attachSwipe(rowEl, {
  max: 64, trigger: 0.75,
  onMove: ({ progress }) => icon.style.opacity = progress,
  onEnd: ({ triggered }) => triggered && startReply()
})

// 5. 主题/状态圆形揭示（View Transitions，无 API 时自动直落）
revealFrom({ x: e.clientX, y: e.clientY, duration: 600, apply: () => document.documentElement.classList.toggle('dark') })
```

### 在框架里接入

- **Vue**：`onMounted(() => attachRipple(el))`，`onBeforeUnmount` 里调用返回的 detach。
- **React**：包一个 `useRipple(ref)` hook（`useEffect` 里 attach/返回 cleanup 即可）。
- **Svelte**：`use:ripple` action 几乎就是 `attachRipple` 逐字翻译。
- **Angular**：Directive 封装 `attachRipple(el.nativeElement)`。

## 配置三条哲学（来自 tweb 的研究结论）

1. **Token 单源**：JS 效果和 CSS transition 读同一组 `--mk-*` 变量（涟漪就是在运行时 `getComputedStyle` 读回来的）。改手感只改一处。
2. **减动效 ≠ 关动效**：位移用 `-move` 时长 token，等级 1 把它置 0 → 位移瞬跳、淡入照常。这是 tweb liteMode 的精髓，也是 `prefers-reduced-motion` 的正确答案：`tokens.css` 已内置回退链（系统偏好在 `[data-motion-keep]` 不存在时强制 0 级）。
3. **可中断永远第一**：所有飞行动画用 keyed 实例，同一目标的新动画自动打断旧动画并清理 DOM 克隆——「飞行叠罗汉」这个级别的 bug 从结构上不存在。

## 演示

仓库根目录 `demo/index.html` 是一个无构建的单页演示，逐个调用本包的每个 API 并实时可调参数：

```bash
cd Motion-Lab
npm run dev          # 然后访问 http://localhost:5173/demo/
```

## API 速查

| 导出 | 作用 | 关键参数 |
| --- | --- | --- |
| `fastRaf / doubleRaf` | 帧合批调度 / 双帧后回调 | — |
| `claimAnimation(key)` | keyed 动画实例 | `cancelled` promise + `done()` |
| `CURVES` | tweb 实测曲线预设 | standard / exit / flightX / flightY / overshoot |
| `bezierValue / bezierCss` | 贝塞尔求值 / 生成 CSS | `[x1,y1,x2,y2]` |
| `springValue / springCss` | 阻尼弹簧 → `linear()` | `bounce 0–0.6` |
| `play / settle` | 永不抛错的 animate 包装 | 异常时回退 `ease-out` |
| `flyClone` | 双曲线快照飞行 + 落位交叉淡出 | `curveX/curveY/landFade/reveal` |
| `flyParabola` | 解析抛物线飞行 + 落点提前显影 | `elevation/landing` |
| `attachRipple` | 最远角涟漪 | `duration/startScale/endScale` |
| `attachSwipe` | 锁轴阻尼手势 | `max/trigger/onMove/onEnd` |
| `createScrollSaver` | 滚动锚点补偿 | `save()/restore()` 夹住 DOM 变化 |
| `revealFrom` | View Transitions 圆形揭示 | `x/y/duration/apply` |

## 许可

MIT（本包） 。tweb 本身是 GPL-3.0，本包不包含其任何源代码。
