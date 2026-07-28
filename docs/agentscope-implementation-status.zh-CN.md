# AgentScope PRD 实现状态

更新时间：2026-07-28

## 已完成的 v1 核心闭环

- Run/Span/Event/Artifact/Checkpoint 领域模型与状态机
- PostgreSQL 追加写事件、投影、Run 元数据与版本化分析
- SSE 实时事件、sequence 断线补拉、陈旧运行恢复
- Trace Tree、筛选折叠、键盘导航、时间轴缩放与视觉回放
- Step Inspector 的 Input/Output/Error/Metrics/Replay/Raw 视图
- 错误起点、重复调用、延迟与 Token 确定性诊断
- Replay Preflight、Fixture Replay、受限真实 Fork 和 Parent/Child 分支
- 任意双 Run 对比、路径对齐置信度、指标与最终输出差异
- 版本化确定性 Eval、Markdown/JSON 报告与分析持久化
- Run Manager 的筛选、排序、显示名、标签与分支导航
- AgentScope Bundle JSON 导入/导出及事件-投影一致性校验
- 三组无 Key 官方 Fixture 和完整离线演示路径
- 进程级自观测计数器

## 已明确限制

- 当前 HarnessLab 业务流程只有一个真实 Provider 模型步骤，不是完整的通用多工具 Agent Runtime；通用 Schema 与接入边界已经建立。
- 真实 Fork 只支持 `provider-inspection`，其他 Fixture 使用确定性 Replay。
- 当前无多租户身份认证和 Project ACL；公网部署必须由平台层补充。
- Run 删除/保留自动化、诊断误报反馈和 LLM-as-a-Judge 属于后续能力。
- 进程级指标不是跨实例持久指标。
- localStorage 仍保存最近完整审计结果作为无数据库演示降级路径；配置数据库后，Trace 事实以 PostgreSQL 为准。

这些限制在 UI 或运行手册中使用明确语义呈现，不把视觉回放描述为真实重执行，也不把确定性规则分数描述为隐藏推理质量。
