# AgentScope｜AI Agent 黑匣子回放器

[![CI](https://github.com/ZackZhang-AI/HarnessLab/actions/workflows/ci.yml/badge.svg)](https://github.com/ZackZhang-AI/HarnessLab/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-059669.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-111111.svg)](https://nextjs.org/)

[English](./README.en.md) · [架构说明](./docs/architecture.zh-CN.md) · [完整 PRD](./docs/agentscope-prd.zh-CN.md)

AgentScope 是 HarnessLab 的 Agent 可观察性扩展：它记录 Agent 的计划、模型决策、工具调用、输入输出、延迟、Token、错误和 Artifact，并把一次失败运行变成可定位、可分支、可比较、可验证的调试闭环。

旗舰案例是一条真实的代码修复 Agent 路径：读取代码、搜索符号、修改文件、运行测试；Parent Run 因错误策略陷入无进展测试循环，用户从安全 Checkpoint 创建 Child Run，应用新策略后通过测试，最后由 Compare 与 Eval 用 Span 证据证明修复有效。

![AgentScope 代码修复黑匣子](./public/harnesslab-desktop.png)

## 三种明确的执行模式

| 模式 | 用途 | 是否真实执行工具 | 依赖 |
| --- | --- | --- | --- |
| 录制回放 | 90 秒作品集演示、CI | 否，读取确定性运行包 | 无 |
| 确定性沙箱 | 本地验证完整 Agent 循环 | 是，执行 `read/search/patch/test` | PostgreSQL、Docker |
| 真实模型沙箱 | 观察 DeepSeek/MiniMax 决策 | 是，工具仍受服务端白名单约束 | PostgreSQL、Docker、API Key |

录制回放不会伪装成真实重执行；沙箱和 Provider 不可用时，`/api/v1/system/capabilities` 会返回稳定原因，UI 仍保留录制入口。

## 核心能力

- 通用 `RunExecutor`、结构化 `DecisionProvider`、`ToolRegistry` 与 `WorkspaceSandbox`
- 固定 `buggy-auth-api` 场景，模型只能选择允许的动作，不能生成任意 Shell
- Docker 非 root、禁网、只读挂载、CPU/内存/PID/超时限制
- 不可变 Parent、Checkpoint Snapshot、Copy-on-Write Child Fork
- Trace Tree、Timeline、可视化回放、Span Inspector 与永久 Run URL
- Patch Diff Viewer、Test Log Viewer 与 PostgreSQL Artifact 存储
- Secret 脱敏、单 Artifact 256KB、单 Run 1MB、内部 Snapshot 不进入导出
- 首次失败、重复调用、Workspace/Test Hash 无变化的 `no_progress_loop` 诊断
- `Resolved / Regressed / Trade-off` Compare 与代码修复专项确定性 Eval
- SSE sequence 续传、事件去重、进程中断收敛和幂等创建/Fork
- 原代码审计工作台继续保留在 `/audit`

## 快速开始

Node.js 22+：

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`，点击 **Start 90-second demo**。该路径不需要数据库、Docker 或 API Key。

启用本地沙箱：

```bash
docker compose up -d
copy .env.example .env.local
npm run db:migrate
npm run dev
```

`.env.local` 至少需要：

```bash
DATABASE_URL=postgresql://agentscope:agentscope@localhost:54329/agentscope
```

真实模型可选配置：

```bash
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
MINIMAX_API_KEY=
MINIMAX_MODEL=MiniMax-M2.7
```

密钥只在服务端读取，不进入浏览器、Trace、Artifact 或导出 Bundle。

## 关键接口

```text
POST /api/v1/runs
GET  /api/v1/runs/:runId/stream
POST /api/v1/runs/:runId/replay-preflight
POST /api/v1/runs/:runId/forks
GET  /api/v1/artifacts/:artifactId
GET  /api/v1/system/capabilities
```

创建请求：

```json
{
  "taskType": "code_fix",
  "scenarioId": "buggy-auth-api",
  "executionMode": "sandbox",
  "decisionProvider": "fixture"
}
```

`recorded` 只允许 `fixture`；测试命令与可修改文件由服务端 Scenario Manifest 固定。

## 质量验证

```bash
npm run typecheck
npm run lint
npm test
npm run eval
npm run build
npm run e2e
npm audit --omit=dev
```

数据库与真实沙箱验收：

```bash
$env:TEST_DOCKER_SANDBOX="1"; npm test -- tests/agentscope-workspace-sandbox.test.ts
$env:TEST_DATABASE_URL="postgresql://agentscope:agentscope@localhost:54329/agentscope"; npm run test:postgres
$env:DATABASE_URL="postgresql://agentscope:agentscope@localhost:54329/agentscope"; $env:E2E_SANDBOX="1"; npm run e2e -- e2e/code-fix-demo.spec.ts --project=chromium
```

## 架构边界

当前版本是 Next.js + PostgreSQL 模块化单体。线上作品集默认使用安全录制数据，本地环境开放固定案例沙箱；不接受任意用户仓库，不包含登录/RBAC、团队协作、计费、批量实验、LLM-as-a-Judge、独立 Worker 或多租户生产隔离。

更多信息：

- [实现状态](./docs/agentscope-implementation-status.zh-CN.md)
- [运行与安全手册](./docs/agentscope-operations.zh-CN.md)
- [安全策略](./SECURITY.md)

## License

[MIT](./LICENSE)
