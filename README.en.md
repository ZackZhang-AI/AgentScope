# AgentScope | AI Agent Black Box Replay

[![CI](https://github.com/ZackZhang-AI/AgentScope/actions/workflows/ci.yml/badge.svg)](https://github.com/ZackZhang-AI/AgentScope/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.3.2-2563eb.svg)](./CHANGELOG.md)

[Live Demo](https://agentscope-harnesslab.vercel.app/demos/code-fix-loop) · [Chinese Demo](https://agentscope-harnesslab.vercel.app/zh/demos/code-fix-loop) · [Video](https://github.com/ZackZhang-AI/AgentScope/releases/download/v0.3.1/agentscope-90-second-demo.webm) · [Case Study](https://agentscope-harnesslab.vercel.app/case-study)

[中文](./README.md) · [Architecture](./docs/architecture.zh-CN.md) · [Changelog](./CHANGELOG.md)

AgentScope is an AI Agent black-box replay tool that traces tool calls, detects no-progress loops, forks immutable checkpoints, and verifies fixes with span-linked evidence.

English keeps the original unprefixed URLs. Chinese uses `/zh`; the compact Header switch preserves Demo and Run paths, query parameters, and hashes. API, Trace, Artifact, and Bundle data remain unchanged.

[![AgentScope social cover](./public/agentscope-social-card.png)](https://github.com/ZackZhang-AI/AgentScope/releases/download/v0.3.1/agentscope-90-second-demo.webm)

## The 90-second story

```text
Failure → Root cause → Fork → Verified fix
```

A code-repair Agent reads source, searches symbols, applies patches, and runs tests. The parent repeats the same failing test while workspace and result hashes remain unchanged. The user forks a safe checkpoint into a child, applies a corrected strategy, and verifies the result through deterministic Compare and Eval evidence.

## Execution profiles

| Profile | Purpose | Infrastructure |
| --- | --- | --- |
| `recorded_only` | Public portfolio and CI | None |
| `local_sandbox` | Deterministic or live-model execution | PostgreSQL and Docker |

The public profile skips Docker probing, hides live-provider controls, and rejects sandbox Run/Fork requests with `SANDBOX_DISABLED`. Local execution remains constrained to the built-in `buggy-auth-api` scenario.

## Engineering highlights

- Generic `RunExecutor`, validated `DecisionProvider`, `ToolRegistry`, and isolated workspace contracts
- Server-owned patch allowlist and test command; models cannot generate arbitrary shell commands
- Non-root, network-disabled Docker runner with CPU, memory, PID, and timeout limits
- Append-only parent events, checkpoint snapshots, and copy-on-write child forks
- No-progress diagnosis using normalized calls plus workspace and test-result hashes
- Diff and log artifacts with redaction, size budgets, content hashes, and visibility rules
- Evidence-linked `Resolved / Regressed / Trade-off` comparison and deterministic code-fix evaluation
- Sequence-based SSE recovery, event deduplication, idempotent Run/Fork creation, and permanent Run URLs
- recorded-only Smoke, axe, Lighthouse, desktop E2E, and mobile E2E gates

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and select `Start 90-second demo`. No key, database, or Docker daemon is required.

For trusted local sandbox execution:

```bash
docker compose up -d
# Copy .env.example to .env.local
npm run db:migrate
npm run dev
```

Set `AGENTSCOPE_EXECUTION_PROFILE=local_sandbox` and configure `DATABASE_URL`. DeepSeek and MiniMax keys are optional server-only settings.

## Verification

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

The current release is a modular monolith and a fixed-scenario portfolio sandbox. It does not execute arbitrary repositories or claim multi-tenant production isolation.

## License

[MIT](./LICENSE)
