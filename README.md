# Telegram Motion Lab

一个受 Telegram Web 交互启发、独立实现的动效实验室。界面按 Telegram Web 的布局复刻：左侧是会话列表和推入式的设置页，右侧是聊天。所有动画都由**设置**实时驱动——不仅可逐项开关，还把 tweb 源码里测得的**机制参数**（飞行曲线、阻尼、阈值、时长）暴露成可调滑杆，可以套用「Telegram 官方手感」预设，也可以放慢 10 倍逐帧观察。

- Vue 3 + Vite 7 + TypeScript，Web Animations API + View Transitions
- 不需要 Telegram 账号或 API；不包含 Telegram 官方源代码、图片、字体或品牌素材

> 仅用于研究和演示动效，与 Telegram 官方无关。

## 复用到其他项目：`packages/motion/`（motion-kit）

本项目把可复用的内核提取成了**零依赖纯 ESM 包**（帧合批、keyed 动画实例、双曲线飞行、抛物线飞行、涟漪、滑动手势、滚动锚点、圆形揭示 + token 样式表），拷进任何框架的项目即可使用。自 v3.2 起**主应用自身也直接 import 这个包**（单一源码，修一处两边生效）。配套 `demo/index.html` 是零构建的交互演示：dev 模式下访问 `http://localhost:5173/demo/`，生产构建（`npm run build`）会把 demo 和包一并放进 `dist/`，随 GitHub Pages 部署到 `<site>/demo/`。详见 [`packages/motion/README.md`](packages/motion/README.md)。

## 本地运行

Node.js 20.19+ 或 22.12+：

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # vue-tsc 类型检查 + 打包
npx playwright install chromium && npm run test:e2e
```

## 交互一览

| 交互 | 操作 | 对应动画开关 |
| --- | --- | --- |
| 消息飞入 | 输入后按 Enter（可改为 Ctrl+Enter） | 发送消息 / 渐变壁纸 |
| 对方回复 | 发送后显示“正在输入…”，然后收到回复 | 新消息入场 |
| 会话切换 | 点击会话，方向跟随列表位置 | 聊天切换 |
| 列表重排 | 新消息让会话移到顶部（FLIP） | 页面推入 |
| 上下文菜单 | 右键 / 触屏长按，从指针位置缩放展开 | 菜单与弹窗 |
| 表情回应 | 菜单里选表情，表情飞向气泡、弹跳并迸发粒子 | 表情回应 / 回应粒子 |
| 滑动回复 | 气泡**向左**拖过约 56 px（也可以双击气泡） | 页面推入 |
| 引用跳转 | 点击气泡里的引用，滚动到原消息并高亮 | — |
| 删除消息 | 菜单 → 删除，高度平滑收起 | 新消息入场 |
| 夜间模式 | 主菜单开关或设置页，从点击点圆形扩散 | 主题扩散 |
| 移动端 | ≤720 px 时先显示列表，聊天从右侧推入 | 页面推入 |

快捷键：`Esc` 逐层返回（菜单 → 回复 → 设置子页 → 搜索），`Ctrl/Cmd + K` 聚焦搜索。

## 设置

主菜单（左上角 ☰）→ 设置，或者聊天顶栏的 ⚙ 直接进入「动画与省电」。

配置体系为**三层模型**（对应 tweb 的 liteMode / CSS token / 具体实现参数）：

- **层 1 · 动画等级**（tweb `animation-level-0/1/2` 的移植）：关闭（全部瞬切）/ 降级（位移瞬跳，保留淡入淡出与颜色过渡）/ 完整。系统「减少动态效果」强制 0 级，省电模式最高 1 级，两者都可在 UI 里看到生效结果。
- **层 2 · 逐类覆盖**：10 个动画类别除了开关之外，每类可以单独覆盖时长（80–800 ms）与缓动曲线；未覆盖的跟随全局「基础时长 ×系数 + 全局曲线」，类别的 chip 上会标注已覆盖的项。
- **层 3 · 机制参数**（动效实验室）：tweb 源码里测得的第一手数值直接可调——
  - 发送飞行：横向 CURVE_X / 纵向 CURVE_Y 两个曲线编辑器（拖动控制点）、落位淡出 ms（tweb `sendFlights`）
  - 表情飞行：抛物线抬升 px、落点显影位置 %（tweb `reactionFlight` 的 ELEVATION / LANDING_UNTIL）
  - 滑动回复：最大跟手位移、触发阈值比例（tweb `bubbles` 的 MAX=64 / 阈值 0.75）
  - 涟漪：起始 / 结束 scale；列推挤：旧页视差 %、旧页亮度 %；滚动锚点补偿开关
- **手感预设**：
  - Motion Lab —— 本项目默认手感；
  - **Telegram 官方手感** —— tweb 源码实测值一键套用：标准曲线 `cubic-bezier(.4,0,.2,1)`、菜单 .2s、列推挤 .2s、聊天切换进 .3s/出 .25s、发送飞行 300 ms 双曲线、回应 300 ms、进夜揭示 600 ms / 出夜 500 ms、涟漪 .7s。
- **配置文件**：全部设置（含机制参数）可导出为 JSON 复制保存，粘贴后一键导入，方便分享研究结果。

- **通用设置**：消息文字大小（12–22）、气泡圆角（4–20），都带实时预览；主题（日间 / 夜间 / 跟随系统）；发送快捷键；12/24 小时制。
- **动画与省电**
  - 省电模式：关闭 / 电量低时自动开启（阈值可调，使用 Battery API）/ 始终开启。开启后重型效果停用（降为等级 1），其余动画缩短 25%。
  - 缓动曲线：Telegram / 柔和 / 灵敏 / 弹簧 / 自定义。曲线图是真实曲线，播放点按实际曲线运动；拖动控制点会切换为自定义贝塞尔曲线；弹簧用阻尼振子求解，生成 CSS `linear()`，浏览器不支持时退回 `cubic-bezier`。
  - 基础时长 120–650 ms，并显示各类动画的实际时长。
  - 10 个动画类别，各自有开关和 ▶ 演示按钮；被等级系统、系统偏好或省电模式停用时会注明原因。
- **动效实验室**：机制参数（层 3）、10 个演示、慢放 1× / 2× / 5× / 10×、五种曲线同屏赛跑对比、FPS 与最长帧显示、是否模拟对方回复。
- **AI 复刻导出**：把当前实时配置（含层 3 机制参数与层 2 覆盖）编译成一份可直接粘贴给任意 AI 的**复刻提示词**——角色设定、效果概述、精确参数表（曲线/时长/阈值原样照抄）、实现步骤、数学公式、工程约束、验收标准，末尾附机器可读 JSON。可选 12 个效果单独导出或全套导出；目标框架（React / Vue / Svelte / 原生）与实现偏好（WAAPI / 纯 CSS / motion 库）会生成对应的框架特定要求。调任何滑杆提示词实时重算，复制即用。

所有设置会经过字段校验后保存到 `localStorage`（`motion-lab-settings-v3`），v2 的旧设置自动迁移（动画开关 → 等级），并兼容最早的 `motion-lab-theme`。

## 源码结构

```
src/
├── App.vue                    布局、会话、消息、手势、菜单、演示
├── settings.ts                三层配置模型（等级 / 类别覆盖 / 机制参数）+ 存储校验与迁移、环境监听
├── motion.ts                  适配层：UI 缓动预设 + 把设置/机制参数桥接到 packages/motion
├── presets.ts                 手感预设（含「Telegram 官方手感」实测值）与配置导入导出
├── aiExport.ts                AI 复刻提示词编译器（实时三层配置 → 结构化 prompt + JSON 附录）
├── ripple.ts                  v-ripple 指令（包装 motion-kit 的 attachRipple，token 桥接）
├── style.css                  主题变量与全部样式（时长/曲线/位移分离 token 均来自 CSS 变量）
└── components/                （SettingsPanel 为异步分包，不进首屏）
    ├── SettingsPanel.vue      推入式设置页（主页 / 通用 / 动画与省电 / 实验室：机制参数 / AI 复刻导出）
    ├── CurveEditor.vue        可拖动的曲线编辑器 + 播放预览
    ├── CompareLanes.vue       曲线对比赛道
    └── ToggleRow.vue / RadioRow.vue / RangeSlider.vue

packages/motion/               motion-kit v1.0.1 — 零依赖动效包（应用与 demo 共用的唯一实现）
demo/                          零构建演示页（构建时随 dist 一起部署）
scripts/                       check-package.mjs（包导入烟雾）/ deploy-demo.mjs（demo 入 dist）
```

## 设计原则

- 只动画 `transform` / `opacity`（删除收起的高度动画除外），避免每帧都触发布局。
- 发送飞行（tweb `sendFlights` 同思路）：快照克隆铺在最上层，真气泡隐藏在终点；X / Y 两条曲线分别驱动（CURVE_X 快出、CURVE_Y 缓升）走出弧线；落位后真气泡显影、克隆交叉淡出（LAND_FADE）。
- 表情飞行是解析抛物线（tweb `reactionFlight`）：`y = y₀ + bt + at²`，中点抬升可调，落点在飞行 75% 处提前显影。
- 滑动回复（tweb `bubbles`）：20px 锁轴弃权、64px 阻尼封顶后按 25% 衰减跟手、阈值 = 封顶 × 比例、图标按进度显影。
- 位移 / 淡入 token 分离：`--dur-*` 驱动淡入与颜色、`--dur-*-move` 驱动 transform；等级 1 只把后者置 0，即得「位移瞬跳、淡入照常」。
- keyed 动画实例 + 帧合批：同一目标的新动画自动打断旧动画，所有 JS 侧动画共用一个 rAF 队列（tweb schedulers/animation）。
- 列表变化时用滚动锚点补偿（tweb `scrollSaver`）：先钉住最上方可见消息，DOM 变化后补偿 `scrollTop`。
- 重动画互斥（tweb `dispatchHeavyAnimationEvent`）：飞行与主题揭示期间持有互斥，壁纸等装饰性过渡让位（`html.mk-heavy-held`）。
- 单一源码：动效实现只存在于 `packages/motion`，应用与 demo 都只是它的调用方——修一处，两边生效，永不漂移。
- 长列表只渲染最近 120 条，“查看更早”每次再加载 120 条；压力测试一次追加 500 条。

## 许可

MIT License。若将来直接移植 tweb 的代码，请遵守其 GPL-3.0 许可。

## 维护与交接

开发约束、测试入口、当前修复范围及后续路线见 [`AGENTS.md`](AGENTS.md)。内核几何、指针取消、主题揭示和配置迁移需要专项回归测试。
