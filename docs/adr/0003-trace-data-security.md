# ADR 0003：Trace 内容在持久化前最小化与脱敏

- 状态：已接受
- 日期：2026-07-28

## 背景

模型消息、工具参数、代码和外部结果可能包含密钥、个人数据或业务敏感信息。先保存原文再异步脱敏会让敏感值短暂进入数据库、备份和日志。

## 决策

- Authorization、Cookie、API Key、密码和密钥永不采集。
- Tool Schema 可以声明敏感 JSON Path。
- 文本和结构化 Payload 在进入 Repository 前完成脱敏。
- 小 Payload 可内联；大于默认 32KB 的内容进入 Artifact Store，Span 只保存引用和摘要。
- 服务端数据访问层只向 Client Component 返回页面所需的 DTO。
- 未采集或被阻止的内容用 `omitted` PayloadRef 明确表达。
- 不采集、不推断模型隐藏思维链。

## 结果

- 脱敏规则需要版本化并有正反例测试。
- 关闭内容采集会降低可重放能力，Replay Preflight 必须说明。
- 复制、比较和报告导出都必须基于同一脱敏投影。
