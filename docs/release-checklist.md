# Motion Lab 3.4.0 发布候选验收

候选版本 3.4.0-rc.1；不在 CI 未通过前创建正式 tag 或 Release。

## 风险分级
- 日常 UI / 文档：npm ci、npm run typecheck、npm run check:pkg；改动对应测试。
- 交互、共享内核、项目存储与导出：npm run build、Chromium 完整回归及 Firefox/WebKit 工作台回归，运行 scripts/verify-exports.mjs。
- 正式发布：候选提交全部 CI 通过；检查三浏览器截图、基准 JSON 和 Chromium GC 后 heap 采样；验证 GitHub Pages 主分支部署及线上三入口、项目导入导出和旧存储迁移。确认后再更新正式版本、创建 tag/Release。

## 基准解释
PR #9 基线：80 节点、30 次连续 FLIP，Chromium 18.1/29.4 ms、Firefox 17/30 ms、WebKit 24/42 ms（P50/P95）。三者残留动画 0。新候选另采两轮 120 次和 Chromium CDP GC 后 heap。只报告实测，不把 CI 间隔当真实硬件 GPU 帧耗时，不把单次 heap 差值当泄漏结论。

## 尚未关闭
实时 FLIP 编排轨道、缩放速度连续性、完整组合 Vue/React 导出、旧聊天剩余业务拆分。候选版本验证不等于正式发布。

## #10 已验收
最新 CI 79/79；首轮 12 张截图与长循环数据已核查。#11 提交组合工程运行与 ZIP、连续缩放中断、移动聚焦等回归，正式版本需完成 #11 及主分支部署验证。任意外部 DOM 绑定和更多聊天业务模块可后续演进。
