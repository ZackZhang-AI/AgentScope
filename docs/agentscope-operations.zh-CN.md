# AgentScope 运行与安全手册

## 1. 运行形态

AgentScope v0.3.0 是模块化单体：

- Next.js 提供工作台、REST API、SSE 与执行编排；
- PostgreSQL 保存不可变 Trace、Run 元数据、分析和 Artifact；
- Docker 仅在本地沙箱测试阶段运行固定 Scenario；
- Recorded Demo 不需要数据库、Docker、网络或模型密钥。

线上作品集建议只开放 Recorded Demo；本地开发环境才开放 Sandbox。

## 2. 配置

```bash
DATABASE_URL=postgresql://agentscope:agentscope@localhost:54329/agentscope
AGENTSCOPE_INTERRUPTED_AFTER_MS=300000
DEEPSEEK_API_KEY=
MINIMAX_API_KEY=
```

启动本地依赖：

```bash
docker compose up -d
npm run db:migrate
npm run dev
```

能力状态通过 `GET /api/v1/system/capabilities` 查询。缺少依赖时接口给出原因，客户端应禁用对应执行入口，而不是隐藏 Recorded Demo。

## 3. 沙箱安全基线

- 只允许 Scenario Manifest 中的 `buggy-auth-api`。
- 每个 Run 创建独立临时工作区。
- 所有路径先解析并验证仍位于工作区内。
- Patch 只能修改 Manifest 允许的文件，且必须精确匹配锚点。
- 模型和客户端都不能提供测试命令。
- 测试容器使用非 root 用户、`--network none`、只读挂载、临时目录以及 CPU、内存、PID、超时限制。
- Docker 不可用时不回退到宿主机 Shell。
- Replay Preflight 拒绝危险副作用、不完整 Checkpoint 和越权操作。

本实现降低固定案例的风险，但不构成任意不可信代码的生产级隔离。

## 4. Artifact 与数据安全

- Provider 密钥仅从服务端环境变量读取。
- Artifact 写入前执行 Secret 脱敏。
- 单 Artifact 最大 256KB，单 Run 最大 1MB。
- 用户可见内容仅支持 `text/plain`、`application/json`、`text/x-diff`。
- Workspace Snapshot 为 internal，不进入默认 Bundle。
- Trace 引用 Artifact ID、Hash、大小与脱敏状态，不复制完整内容。

公网部署仍必须补充身份认证、授权、TLS、速率限制和组织级数据保留策略。

## 5. 可靠性

- Run/Fork 接受 `Idempotency-Key`。
- SSE 事件包含稳定 `runId` 与单调 sequence。
- 客户端按 `eventId` 去重；刷新后通过 Run/Event 接口恢复 Projection。
- `/api/v1/runs/:runId/stream` 支持持久 Run 的轮询式 SSE 续传。
- 陈旧 `running` Run 在启动恢复阶段收敛为 `runner_interrupted`。
- Parent/Child 使用数据库关系约束，Fork 不覆盖 Parent。

## 6. 数据库迁移

```bash
npm run db:migrate
```

当前表：

- `agentscope_runs`
- `agentscope_trace_events`
- `agentscope_analyses`
- `agentscope_artifacts`

迁移按 `db/migrations/*.sql` 文件名顺序幂等执行。

## 7. 发布检查

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run eval
npm run build
npm run e2e
npm audit --omit=dev
```

数据库与 Docker：

```bash
docker compose up -d
npm run db:migrate
$env:TEST_DATABASE_URL="postgresql://agentscope:agentscope@localhost:54329/agentscope"; npm run test:postgres
$env:TEST_DOCKER_SANDBOX="1"; npm test -- tests/agentscope-workspace-sandbox.test.ts
$env:DATABASE_URL="postgresql://agentscope:agentscope@localhost:54329/agentscope"; $env:E2E_SANDBOX="1"; npm run e2e -- e2e/code-fix-demo.spec.ts --project=chromium
docker compose down
```

发布前还应人工确认：

- 首页明确标注三种执行模式；
- 永久 Demo URL 刷新后可恢复；
- Parent 失败、Child 成功、Artifact 可读；
- Compare 与 Eval 结论能跳转到证据 Span；
- 移动端主控件可见；
- 未配置 Key、数据库或 Docker 时降级文案正确。
