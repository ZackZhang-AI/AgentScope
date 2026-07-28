# ADR 0005：基于 Checkpoint 的不可变分支重跑

- 状态：接受
- 日期：2026-07-28

## 背景

AgentScope 需要从失败步骤继续执行，同时保证历史 Trace 不被覆盖、外部副作用不被静默重复。视觉回放不执行任何步骤，真实重跑必须创建新的 Run。

## 决策

1. 只有存在完整 `ReplayCheckpoint` 的 Span 才能进入真实 Fork。
2. Fork 前运行确定性 Preflight，校验：
   - Parent Run 与目标 Span 存在；
   - 任务输入哈希与 Parent 一致；
   - Checkpoint 完整；
   - 目标与下游步骤具有明确执行策略。
3. 工具策略分为：
   - `execute`：只读或幂等工具可以真实执行；
   - `fixed_response`：有副作用但已有历史输出时复用固定响应；
   - `blocked`：危险或未知副作用且无固定响应时阻止 Fork。
4. 每次 Fork 创建新的 Child Run，并写入 `parentRunId` 与 `forkedFromSpanId`。
5. Child Run 从 `checkpoint-restore` Span 开始，不重新执行已恢复的 intake 和 plan。
6. Parent 的事件、投影和评测结果保持不可变。

## 当前垂直实现

HarnessLab v1 首先支持从 `provider-inspection` 模型 Span Fork。通用工具执行器尚未接入的 Span 即使通过通用 Preflight，也不会被当前 API 误报为可执行，而是返回能力边界错误。

## 后果

- 分支来源可审计，Compare 可以直接对齐 Parent 与 Child。
- 浏览器无数据库演示可携带经过 Schema 校验的 Parent Projection；配置 PostgreSQL 时以数据库投影为权威。
- 修改任务内容不属于同一 Fork，必须创建新的独立 Run。
- 后续新增工具只需声明副作用等级并接入执行器，无需修改 Trace 历史模型。
