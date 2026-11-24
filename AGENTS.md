# Motion-Lab 开发交接

## 项目定位
Telegram Web 启发的独立动效研究实验室。Vue 3 / Vite / TypeScript，零依赖 ESM motion-kit；不引入 Telegram 官方源代码或素材。保留现有 UI 和 localStorage v3 配置，不擅自重置用户设置。

## 源码职责
- packages/motion：共享动效内核，保持 JS 和 index.d.ts 同步；主应用和 demo 共用。
- src/settings.ts：三层参数、环境等级、校验与持久化。
- src/motion.ts：应用适配；src/aiExport.ts：提示词及精确参数导出。
- src/App.vue / src/components/SettingsPanel.vue：当前主要应用及设置 UI。
- tests：主应用、零构建 demo、内核回归。

## 验证与交付
Node 22；npm ci；npm run check:pkg；npm run build；npx playwright install chromium；npm run test:e2e。
日常快速检查；内核、交互和持久化改动必须跑专项浏览器回归；正式发布完整测试和 Pages 验收。中文 Git commit；独立 PR，检查通过再合并；不要伪造测试结果。保留部署 base './' 和 dist/demo。
动效需可中断、可回收、尊重等级 0/1/2；避免重复实现。级别 0 不显示涟漪，级别 1 在启用时保留 120ms 闪白。

## 当前批次
修复抛物线 X 起止、动画取消清理、涟漪零值和指针生命周期、圆形揭示一次性更新、滚动锚点查询、覆盖值校验与电池监听清理。通过独立 PR 验证；CI 结果以 GitHub Actions 为准。

## 后续路线
1. 拆分 App.vue 的消息、手势和导航逻辑，将应用滑动行为与共享内核统一，保留长按和回复。
2. 将设置面板拆成分组组件，整理动效目录与可搜索的实验工作台。
3. 增加可保存的参数方案、A/B 对比、独立代码与 CSS token 导出。
4. 增加 Firefox/WebKit 专项验证、键盘可操作性及性能诊断；实测后优化，不编造 FPS。
每批更新本文件及 CHANGELOG，记录已验证范围、遗留问题和 PR 状态。

## 工作台集中开发批次（PR #5 已合并，31/31 通过）
- 入口：/?workspace=1，原 / 聊天和 /demo/ 保留；新资产键 motion-lab-workspace-v1，不覆盖旧设置。
- src/workspace：model（目录、配置、关键帧）、assets（版本与合并导入）、export（代码生成）、usePlayback（播放时间）、Preview / Workspace（界面）。src/chat：聊天样本数据和共享滑动指令；SettingsExport 独立组件。
- packages/motion/layout.js：FLIP、共享元素几何、弹簧采样、级联与取消。浏览器回归：Chromium 完整套件，Firefox/WebKit 工作台专项。
- 外部风格为基于公开设计原则的自定义参数，非官方精确复刻。来源见工作台链接。
- 已知边界：布局和拖拽依赖真实 DOM，暂不支持完整时间轴/静态代码导出；跨浏览器测试以 CI 为准，尚未发布。后续继续拆分原聊天和设置其他分组、完善导出及实际视觉验收。
