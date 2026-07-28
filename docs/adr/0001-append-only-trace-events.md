# ADR 0001：使用追加事件构建 Agent Trace

- 状态：已接受
- 日期：2026-07-28

## 背景

HarnessLab 原有 `AgentEvent` 使用六个固定阶段 ID，同一阶段更新会覆盖旧值，无法表达重复工具调用、并发、嵌套 Agent 和中途失败。

## 决策

运行事实使用有单调 `sequence` 和幂等 `eventId` 的 `TraceEvent` 追加写入；`Run`、`Span`、`Artifact` 和 `Checkpoint` 是通过事件构建的读取投影。

事件与导出格式都包含 `schemaVersion`。投影器拒绝跨 Run 引用、逆序事件、重复事件、非法状态迁移和未知父 Span。

## 结果

- 原始运行历史不可变，同类调用不会互相覆盖。
- SSE 可以按序号断点续传。
- 失败进程已经写入的事件仍能形成部分 Trace。
- 投影器成为导入、持久化、诊断、回放和测试共享的事实边界。
- v1.0 不建设通用事件溯源框架，只维护 AgentScope 所需的有限事件集合。
