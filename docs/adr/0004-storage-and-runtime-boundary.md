# ADR 0004：模块化单体、PostgreSQL 目标存储与可替换执行边界

- 状态：已接受
- 日期：2026-07-28

## 背景

AgentScope 需要可靠历史和分支关系，但当前规模不足以证明微服务、消息队列或分布式工作流引擎的复杂度合理。Next.js 运行时又要求数据库和文件系统能力留在 Node.js 服务端。

## 决策

- v1.0 使用 Next.js Node.js Runtime 的模块化单体。
- Domain 不依赖 Next.js、React 或具体数据库。
- PostgreSQL 是 Run、Span、Event、Diagnostic 和 Eval 的目标存储。
- Artifact Store 通过接口隔离；开发环境可使用本地文件，部署环境可接 S3 兼容存储。
- Harness 执行通过 `RunExecutor` 接口隔离，首版同进程执行。
- 只有长任务、并发或进程恢复需求达到 PRD 阈值时才拆独立 Worker。

## 结果

- 首版部署和本地开发保持简单。
- 数据访问层使用 `server-only` 边界，Client 不接触数据库或密钥。
- 将来拆 Worker 时保持领域与应用接口不变。
- Mock Fixture 路径继续保证无 API Key 的稳定演示。
