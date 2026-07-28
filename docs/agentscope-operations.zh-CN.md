# AgentScope 运行与安全手册

## 1. 部署形态

当前版本是模块化单体：

- Next.js 提供工作台、REST API 与 SSE；
- PostgreSQL 保存不可变 Trace、Run 元数据和版本化派生分析；
- Docker Compose 仅用于本地 PostgreSQL；
- Mock Demo 不需要数据库、网络或模型密钥。

生产部署前执行：

```bash
npm ci
npm run db:migrate
npm run build
npm run typecheck
npm run lint
npm test
npm run e2e
npm audit --omit=dev
```

2026-07-28 发布验收时，生产依赖审计结果为 0 个漏洞。完整开发依赖审计仍会报告 ESLint 9 间接依赖的 `brace-expansion` 高危拒绝服务漏洞；官方修复只发布在 5.x，而 ESLint 9 依赖 1.x。当前项目不把外部输入传给 ESLint/glob，且这些包不进入生产运行时，因此不使用跨主版本 override。升级 ESLint 工具链后应重新执行完整审计。

## 2. 必要配置

```bash
DATABASE_URL=postgresql://user:password@host:5432/agentscope
AGENTSCOPE_INTERRUPTED_AFTER_MS=300000
```

`DATABASE_URL` 未配置时，实时运行和离线 Fixture 仍可使用，但持久化历史、断线补拉、分析存储和 Run 元数据编辑不可用。

## 3. 数据安全边界

- Provider 密钥只从服务端环境变量读取，不进入浏览器、Trace 或导出 Bundle。
- 源代码正文默认不写入 AgentScope Trace；Trace 保存标准化哈希、文件名和结构化摘要。
- Payload 使用 `inline`、`artifact`、`omitted` 三种显式引用，省略内容必须给出原因。
- Replay Preflight 默认阻止 `destructive`、未知副作用或不完整 Checkpoint。
- 导入 Bundle 通过严格 Schema 校验；存在原始事件时，系统重新投影并拒绝被单独篡改的 Projection。
- PostgreSQL 行为是单项目本地开发基线。公网或多租户部署必须在反向代理/平台层增加身份认证、Project 级授权和 TLS；当前仓库不声称已提供多租户隔离。

## 4. 可靠性

- SSE 的结构化 Trace 事件包含 `id: sequence`。
- 客户端以最后序号调用 `/api/v1/runs/:runId/events?after=` 补拉并按 `eventId` 去重。
- 浏览器断开后，服务端继续执行并持久化事件。
- Next.js 进程启动时扫描陈旧 `running` Run，将未闭合 Span 以 `runner_interrupted` 收敛为错误终态。
- `AGENTSCOPE_INTERRUPTED_AFTER_MS` 最小为 30 秒，默认 5 分钟。

## 5. 迁移与数据保留

`npm run db:migrate` 会按文件名顺序幂等执行 `db/migrations/*.sql`。当前表：

- `agentscope_runs`
- `agentscope_trace_events`
- `agentscope_analyses`

当前版本不提供 UI 物理删除。生产环境应由运维任务按组织策略归档或删除，并在删除前导出 AgentScope Run Bundle。Parent/Child Run 使用限制删除关系，避免留下无父分支。

## 6. 自观测

`GET /api/v1/system/metrics` 返回进程级 JSON 计数器：

- Run/Fork 启动与完成；
- Trace 事件持久化；
- 执行错误；
- SSE 断开与补拉；
- Replay Preflight 拒绝。

这些计数器不包含输入输出、密钥或个人信息。它们随进程重启清零，多实例生产环境应由日志/指标采集器聚合。

## 7. 导入导出协议

AgentScope Run Bundle：

- `kind = agentscope.run.bundle`
- `bundleVersion = 1`
- 包含 Projection、可用时的不可变事件、版本化诊断与 Eval；
- `source = projection_snapshot` 表示原始事件不可用；
- Eval 报告包含 `reportSchemaVersion` 和 `inputTraceSequence`。

导入只用于分析和视觉回放，不会自动执行模型、工具或 Fork。
