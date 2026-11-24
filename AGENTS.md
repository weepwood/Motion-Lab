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

## 工作台打磨批次（依赖 PR #6）
- PR #6 首次 CI：旧场景 31 项通过，工作台 6 项因同名选择器失败；53fa8a7 已分离无障碍名称并重跑，合并以新 CI 为准。
- WorkspaceLibrary、TimelinePanel、useFrameMetrics、SettingsGeneral、chat/rows 拆分；沿用已有 CurveEditor、Vue、Lucide、Motion Kit，避免新增依赖。
- 时间轴：循环、速度、轨道刻度、A/B、关键帧定位和方向键移动；静态预览可控，布局/拖拽仍由真实 DOM 操作。
- JS/Vue/React 的布局/手势导出生成可接入的 mount/dispose 示例，需将 packages/motion 拷贝至 ./motion-kit（或修改导入路径）；CSS 仅布局样式不模拟真实手势。已补充导出 JavaScript 真实挂载、布局重排、拖动及卸载浏览器测试；Vue/React 独立项目构建仍未执行。
- 资产新建后立即绑定版本 ID；存储键保持不变。无真实截图视觉验收或跨浏览器最终结果之前不得宣称已发布。

## 专业工具增强批次（依赖 PR #7）
- 拖动关键帧、手势录制与单次回放、资产重命名/软删除/恢复/批量、同类型版本 A/B、物理弹簧采样、独立 HTML 导出；新增 AssetPanel 拆分。
- HTML 内联 ESM 依赖源码，需实际运行验证；Vue/React 独立项目构建与 ZIP 包仍待完成。截图由 CI 采集，不等于人工视觉验收；性能指标是 rAF 估算而非 GPU/内存基准。保留旧存储键与已有资产。

- PR #7 首次 CI 42 通过、1 失败：Firefox CSS 序列化差异。改用 DOMMatrixReadOnly.m41 数值断言，并同步到本分支。截图 artifact 总是上传；新增独立 HTML 实际运行回归。

- 完整 ZIP 导出包含全部格式、HTML、配置及 motion-kit；独立 CI job 在临时 Vue / React 工程构建 8 种效果，React 仅为验证依赖。拆分 SettingsMechanisms。新增关键帧拖动和 ZIP 测试。均待 CI 验证。

- 拖拽预览在按下时读取当前视觉矩阵，避免回弹中断跳变；释放速度来自最近有效采样，停顿超过阈值时归零，有限时长物理弹簧末帧归位。导出拖拽仍使用原先缓动复位，尚未与增强预览完全同步。新增三类阻尼端点/手势回放回归。

## PR #8 质量收口
- 首次 CI：Vue/React 独立构建成功；浏览器 57/58，Firefox 原 Vite 页面 setContent 后出现导航竞争。改用独立 data URL 新页面验证 HTML，保留真实交互断言。
- Pages #7 两次部署失败（产物元数据缺失、同名重复），部署产物按 run_id/run_attempt 唯一命名，避免重试复用旧名称。待新 CI 和部署验证。

## 编排与一致性批次
- PR #8 首次 CI 实际截图六张：三浏览器桌面结构一致，移动页过长，原生滑块差异、预览空旷、刻度对齐需改进。新增统一滑块、界面卡片预览、刻度边距及紧凑移动导航。
- 独立编排模式及 motion-lab-composition-v1 键；最多 24 条静态轨道，各自类型、延迟、时长、位移、静音、排序、缩放和吸附。暂不支持轨道导出或手势轨道。
- attachSpringDrag 共享预览/导出运行时；重按读取视觉矩阵并承接位置，释放速度按近期指针采样估计；不宣称所有转场的速度连续。

- 编排轨道可拖动延迟并吸附；参数检查器拆分为 ParameterPanel，隐藏无关参数；聊天 FPS 生命周期拆分 useFps。编排模式独立检查区，旧单动效/资产不变。

- 导出门禁新增实际 Chromium 运行 Vue/React 构建产物及 ZIP 解包/CRC 校验；基准输出 80 节点 30 次 FLIP 的 rAF 分位与取消后残余动画/节点连接状态。未提供实际 JS heap 数据或 GPU 掉帧。

- #8 复测 58/58、Vue/React 8/8 并合并。#8 Pages 上传产物 ID 14923067016 后立即部署查询不到，随后 API 可查到该产物；触发重试并为后续版本添加部署前唯一元数据轮询，未宣称已部署。
