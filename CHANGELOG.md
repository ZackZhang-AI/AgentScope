# 更新日志

## 0.3.1 - 2026-08-01

- 新增 `recorded_only` 与 `local_sandbox` 执行配置，公开部署默认失败关闭
- 将 90 秒进度条升级为可操作引导，直接聚焦失败 Span、无进展证据和 Replay 安全信息
- 新增 Verified Fix 事实摘要与 `/case-study` 产品案例说明
- 新增 recorded-only Production Smoke，覆盖页面、能力接口、沙箱拒绝和 Artifact 读取
- 新增 axe 严重问题门禁与 Lighthouse 性能、可访问性、LCP 和 Console Error 预算
- 新增桌面与移动端完整旗舰演示 E2E，并修复小屏 Trace 与 Inspector 的宽度约束
- 新增自动录屏脚本、双语介绍、简历 Bullet、项目讲稿与面试 FAQ
- 新增 1200×630 社交分享图、Open Graph、Twitter、robots 与 sitemap 元数据

## 0.3.0 - 2026-07-29

- 新增通用多工具 Agent 执行器与结构化 Decision Provider
- 新增固定代码修复场景和 Docker 安全沙箱
- 新增 PostgreSQL Artifact、Patch Diff 与测试日志查看
- 新增 Checkpoint Snapshot、不可变 Parent 与 Child Fork
- 新增基于 Workspace/Test Hash 的无进展循环诊断
- 新增代码修复专项 Compare 与证据化 Eval
- 新增 90 秒录制演示、Run 深链接与 SSE 刷新恢复
- 保留 `/audit` 原代码审计工作台并完成全量回归

## 0.2.0 - 2026-07-28

- 新增真实 SSE 审计轨迹
- 新增 MiniMax Provider
- 新增公开 GitHub PR 导入
- 新增可选择审查规则
- 新增 Provider 耗时、Token 和 Prompt 版本指标
- Eval Card 改为 Harness 确定性评分
- 新增 PR 评论复制与可复现 Mock 评测集
- 强化 CI、依赖安全和中文项目文档
