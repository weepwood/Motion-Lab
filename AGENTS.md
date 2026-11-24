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

## 工程化与发布候选批次
- PR #9 CI 64/64，Vue/React 16 个构建及运行验收，ZIP 22 文件 CRC 成功；#8 Pages 重试成功。基准 80 节点 30 次 FLIP：Chromium P50/P95 18.1/29.4ms，Firefox 17/30ms，WebKit 24/42ms，三者残留动画 0、节点全脱离。数据来自 CI，不是 GPU 或 heap 实测。
- 工程格式 version:1，兼容原数组存储；导入采用追加及新 ID，最多 24 条，不覆盖现有轨道。新增组同步位移、独立关键帧、录制手势轨道、编排 JSON 与离线 HTML。实时布局轨道仍不支持。
- 可折叠面板、宽度拖动与键盘调整（宽度持久化），默认界面卡片、新通知场景；移动端可收起面板。

- 共享布局物理模式保存前一动画采样速度，重新捕获几何时承接平移速度；缩放速度仍不继承。物理采样末段平滑收敛，拖拽与共享布局/导出共用质量刚度阻尼配置。手势录制播放生命周期增加代际保护。新增物理中断位置与清理回归。

- #9 Pages 部署 45401351606 成功。新增 SettingsPower、两轮 120 次重复 FLIP / Chromium CDP GC 后 heap 采样、编排与通知截图、手势轨道真实录制回归。版本设为 3.4.0-rc.1（package 与 lock 同步），正式 release 需满足 docs/release-checklist.md；候选暂未发布。

- 物理布局首次动画保留配置的初始速度；只有有效运行中的物理动画才覆盖初速。面板捕获失败容错及轨道显示边界钳制。

## V3.4.0 收口批次
- #10 最新 CI 79/79、Vue/React 16 构建及运行、ZIP 22 条 CRC 全通过，合并提交 209df64。首轮截图 12 张，移动端仍偏长。30 次 FLIP P95 17.1/22/27 ms；两轮 120 次 P95 Chromium 17.8/18.0、Firefox 19/20、WebKit 19/17 ms，残留 0。Chromium GC 后 usedSize 4984408→5050792→5006920 字节；差异受运行器负载影响，不证明无泄漏。
- 编排增加实时测量的内置 FLIP/共享元素场景与同一播放时钟的组合预览；mountComposition 被工作台与整体 HTML/Vue/React/ZIP 共用。不是任意外部 DOM 编排器。原 v1 存储兼容。

- 物理 FLIP 继承实际像素宽高变化速度并按新目标几何归一化；普通 FLIP 仅对有效物理动画采集速度以减少额外分配。新增连续中断宽高/位置、移动端默认聚焦及实际组合工程构建运行门禁。
- 移动端默认收起两侧，手动展开互斥；聊天菜单定位抽离。候选仍须完整 CI、最新截图/基准、部署验证后才创建正式 Release。

- 收口分支将应用和 lockfile 版本同步为 3.4.0，属于待验证的发布提交；未创建正式 tag/Release。保持独立 motion-kit 的版本不变（未单独发布）。

- 收口复查：独立布局轨道传递稳定对象而非逐帧新数组；组合运行时统一 ResizeObserver 与卸载清理，批量布局写入，物理动画 settle 后释放采样缓存。新增时间轴 seek 不重建 DOM 的回归。

## PR #11 发布质量修复
- 最新 CI 85/88，导出工程构建运行及 23+8 ZIP CRC 全通过。三浏览器共同失败为编排布局测试：独立预览先 seek 到 160ms，组合预览沿用此时间，原断言从中间态比较末态且选择最终 DOM 首元素。改为先 seek 0、验证动画实际时间、固定被移动对象并比较完整行程，保留 >10px 实际几何断言。等待完整复测，不提前发布。

- #11 失败轮 15 张截图复查：首次移动端聚焦三浏览器均 844 CSS px；桌面动态缩小后 WebKit 截图仍展开面板。补充 resize 同步与卸载清理，仅在跨断点时重置面板，截图前必须验证 aria-pressed 及实际隐藏。
- 失败轮基准：30 次 P95 Chromium 16.9、Firefox 18、WebKit 61ms；两轮120次 P95 分别17.1/17.6、20/20、17/17ms，残留 0。Chromium GC 后 usedSize 4992684→5071336→5028208 B（+35524 B，约0.71%），不证明无泄漏。短时 WebKit 尾延迟波动仍需观察，未把本轮视为稳定性能提升。
