# Telegram Motion Lab

一个受 Telegram 交互体验启发的**独立实现**的丝滑动画实验项目。

- Vue 3 + Vite 7 + TypeScript
- 消息从编辑框飞入、会话页面转场、右键上下文菜单、表情反馈、滑动回复、按压反馈
- Telegram / 柔和 / 灵敏 / 回弹四种缓动、时长控制、减少动画、低功耗模式
- 手机和桌面布局适配；不需要 Telegram 登录、账号或 API

> 仅研究与演示动效，不隶属于 Telegram，也不包含官方客户端代码。

## Telegram Web 风格与图标

- 参考 [morethanwords/tweb](https://github.com/morethanwords/tweb) 的聊天界面层级、圆形头像、消息气泡与左右分栏。**不是 Telegram 的完整客户端，也不接入 Telegram API。**
- 使用 [Lucide](https://lucide.dev/) 的 `lucide-vue-next` 统一主要操作图标。
- 默认采用更接近 tweb 的双栏聊天布局，没有独立品牌顶栏和底部状态栏。点击会话栏菜单或聊天顶栏设置按钮打开动效设置抽屉。抽屉中的月亮 / 太阳按钮与主题选项可切换深浅色。
- 动效仍是本项目的独立实现；未复制 tweb 的源代码、图片、字体或品牌素材。若将来直接移植 tweb 的代码，应遵守其 GPL-3.0 许可证。

## 本地运行

Node.js 20.19+ 或 22.12+：

```bash
npm install
npm run dev
```

浏览器访问终端显示的地址（通常是 http://localhost:5173）。

```bash
npm run typecheck
npm run build
npm run preview
```

## 试验交互

1. 发送消息：输入文本后按 Enter，或点击发送按钮。
2. 页面转场：点击左侧聊天会话。
3. 上下文菜单：右键消息，或触摸长按。
4. 表情反馈：从消息菜单选择表情。
5. 手势回复：向右拖动消息气泡超过约 55 px。
6. 微交互：试试按键、按钮与工具栏。

通过菜单按钮打开设置抽屉，可实时调整曲线和时长。按 Esc 可关闭菜单与设置；Ctrl/Cmd+K 可聚焦搜索。

## 设计原理

- 动画内容尽量使用 transform/opacity，避免每帧布局
- Web Animations API 对 DOM 状态进行合成
- 使用元素的实际 DOMRect 作为飞入动画的起终点
- 页面 transition 实现插入/移除动画
- Pointer Events 负责跟手滑动，再通过物理感缓动回到终点
- 响应 `prefers-reduced-motion`；为低性能设备提供开关

源码核心在 `src/App.vue`、`src/motion.ts` 和 `src/style.css`。

## 开源许可

MIT License。
## 动效稳定性与性能验证

本仓库在 CI 上执行 Vue 类型检查、Vite 构建与 Chromium Playwright 浏览器测试：

```bash
npm install
npx playwright install chromium
npm run build
npm run test:e2e
```

覆盖发送动画清理、菜单边缘定位、主题持久化、频繁切换会话、连续发送、减少动态效果及 500 条消息长列表场景。

- 会话列表采用最近消息窗口：初始只渲染末尾 120 条；点“查看更早的消息”按 120 条逐批加载。
- “压力测试”一次添加 500 条模拟消息，测试响应速度与 DOM 数量，**不代表大型真实 Telegram 消息库的性能基准**。
- 页面包含实验性动画，尚需在真实触控设备、低端 GPU 以及多浏览器上进行视觉和性能回归。
- 发送动画以目标气泡的 `DOMRect` 为终点；新消息或会话切换可打断上一段飞行动画。
- 菜单锚点随气泡位置计算，并约束在可视视口内；滑动回复通过方向锁避免与垂直滚动竞争。
