# AgentScope | AI Agent 黑匣子回放器

[![CI](https://github.com/ZackZhang-AI/HarnessLab/actions/workflows/ci.yml/badge.svg)](https://github.com/ZackZhang-AI/HarnessLab/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-059669.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.3.1-2563eb.svg)](./CHANGELOG.md)
[![Next.js](https://img.shields.io/badge/Next.js-16-111111.svg)](https://nextjs.org/)

[Live Demo](https://agentscope-harnesslab.vercel.app/demos/code-fix-loop) · [Video](https://github.com/ZackZhang-AI/HarnessLab/releases/download/v0.3.1/agentscope-90-second-demo.webm) · [Case Study](https://agentscope-harnesslab.vercel.app/case-study)

[English](./README.en.md) · [求职展示材料](./docs/job-search-kit.zh-CN.md) · [架构说明](./docs/architecture.zh-CN.md) · [更新日志](./CHANGELOG.md)

AgentScope 是一个 AI Agent 黑匣子回放器：追踪计划、模型决策、工具调用、延迟、Token、错误和 Artifact，定位无进展循环，从不可变 Checkpoint 创建 Child Run，并用 Span 证据验证修复。

[![AgentScope social cover](./public/agentscope-social-card.png)](https://github.com/ZackZhang-AI/HarnessLab/releases/download/v0.3.1/agentscope-90-second-demo.webm)

## 90 秒旗舰演示

```text
Failure → Root cause → Fork → Verified fix
```

固定案例中的代码修复 Agent 会执行 `read_file`、`search_code`、`apply_patch` 和 `run_tests`。Parent 因错误策略连续运行相同测试，Workspace/Test Hash 保持不变；用户从安全 Checkpoint 创建 Child，新策略通过测试，Compare 与 Eval 再以证据 Span 验证结果。

![AgentScope trace explorer](./public/harnesslab-desktop.png)

## v0.3.1 求职展示版

- 公开环境使用 `recorded_only`，不探测 Docker、不展示 Live Provider，沙箱请求稳定返回 `SANDBOX_DISABLED`。
- 四步引导直接聚焦首次失败、`no-progress-loop` 证据和 Replay 安全信息，成功后显示 Parent/Child 事实差异。
- `/case-study` 解释 Hash 诊断、不可变 Fork、Docker 边界和确定性 Eval。
- recorded-only Smoke、axe、Lighthouse、桌面与移动 E2E 进入 CI。
- Lighthouse 预算：Performance ≥ 90、Accessibility ≥ 95、LCP ≤ 2.5 秒、无 Console Error。
- 提供自动录屏脚本、双语介绍、简历 Bullet、3 分钟与 10 分钟讲稿及面试 FAQ。

## 三种执行模式

| 模式 | 是否执行真实工具 | 依赖 | 使用位置 |
| --- | --- | --- | --- |
| Recorded replay | 否，读取确定性运行包 | 无 | Vercel Production、CI、面试演示 |
| Deterministic sandbox | 是，执行固定 `read/search/patch/test` | PostgreSQL、Docker | 可信本地环境 |
| Live-model sandbox | 是，模型选择结构化白名单动作 | PostgreSQL、Docker、API Key | 可信本地环境 |

公开部署不配置数据库、Docker 或模型密钥。录制回放不会伪装成真实执行。

## 架构

```mermaid
flowchart LR
  UI["Trace / Replay / Compare / Eval"] --> API["Versioned API + SSE"]
  API --> EX["RunExecutor"]
  EX --> DP["DecisionProvider"]
  EX --> TR["ToolRegistry"]
  TR --> WS["WorkspaceSandbox"]
  WS --> DK["Docker Test Runner"]
  EX --> EV["Append-only Trace"]
  EX --> AR["ArtifactStore"]
  EV --> PG["PostgreSQL"]
  AR --> PG
  EV --> AN["Diagnostics / Compare / Eval"]
  AN --> UI
```

核心边界：

- Provider 只能返回 Zod 校验后的动作，不能生成任意 Shell。
- Scenario Manifest 固定可修改文件和测试命令。
- Parent 事件追加写；Child 从 Snapshot Copy-on-Write 恢复。
- Docker 非 root、禁网，并限制 CPU、内存、PID 和执行时间。
- Artifact 持久化前脱敏，单个 256KB、单 Run 1MB，内部 Snapshot 默认不导出。
- Compare 只输出 `Resolved / Regressed / Trade-off`，Eval 使用版本化确定性规则。

## 快速开始

只体验录制演示：

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`，点击 `Start 90-second demo`。不需要 Key、数据库或 Docker。

启用本地真实沙箱：

```bash
docker compose up -d
copy .env.example .env.local
npm run db:migrate
npm run dev
```

`.env.local`：

```bash
AGENTSCOPE_EXECUTION_PROFILE=local_sandbox
DATABASE_URL=postgresql://agentscope:agentscope@localhost:54329/agentscope
DEEPSEEK_API_KEY=
MINIMAX_API_KEY=
```

## 质量门禁

```bash
npm run typecheck
npm run lint
npm test
npm run eval
npm run build
npm run smoke:recorded
npm run e2e
npm run lighthouse
npm audit --omit=dev
```

PostgreSQL 与 Docker 集成测试需要对应服务：

```bash
$env:TEST_DATABASE_URL="postgresql://agentscope:agentscope@localhost:54329/agentscope"; npm run test:postgres
$env:TEST_DOCKER_SANDBOX="1"; npm test -- tests/agentscope-workspace-sandbox.test.ts
```

## 明确边界

当前是 Next.js + PostgreSQL 模块化单体，只执行仓库内置 `buggy-auth-api`。本版本不包含任意仓库执行、登录、RBAC、多租户、计费、Dataset、LLM-as-a-Judge、独立 Worker 或消息队列。

- [完整 PRD](./docs/agentscope-prd.zh-CN.md)
- [架构说明](./docs/architecture.zh-CN.md)
- [实现状态](./docs/agentscope-implementation-status.zh-CN.md)
- [运行与安全手册](./docs/agentscope-operations.zh-CN.md)
- [求职展示材料](./docs/job-search-kit.zh-CN.md)

## License

[MIT](./LICENSE)
