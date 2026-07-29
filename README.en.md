# AgentScope — AI Agent Black Box

[![Version](https://img.shields.io/badge/version-0.3.0-2563eb.svg)](./CHANGELOG.md)

[中文](./README.md) · [Changelog](./CHANGELOG.md) · [Architecture (Chinese)](./docs/architecture.zh-CN.md) · [PRD (Chinese)](./docs/agentscope-prd.zh-CN.md)

AgentScope extends HarnessLab with evidence-backed Agent observability. It captures plans, model decisions, tool calls, inputs, outputs, latency, tokens, errors, and artifacts, then turns a failed run into a debuggable and verifiable branch.

The flagship story follows a code-repair Agent that reads source, searches symbols, applies a patch, and runs tests. The immutable parent repeats a failing test without workspace progress. A child is restored from a safe checkpoint, applies a corrected strategy, passes the target tests, and is compared with its parent through span-linked diagnostics and deterministic evaluation.

![AgentScope code-fix black box](./public/harnesslab-desktop.png)

## What's new in v0.3.0

- **Agent black-box runtime:** a generic multi-tool executor, structured decision providers, and a server-owned tool allowlist.
- **Failure-to-fix workflow:** checkpoints, immutable parents, child forks, replay preflight, and evidence-linked comparison and evaluation.
- **Real execution boundary:** a fixed code-repair scenario that runs `read/search/patch/test` inside a non-root, network-disabled, resource-limited Docker sandbox.
- **Durable evidence:** PostgreSQL-backed traces, runs, analyses, and artifacts with patch diffs, test logs, span evidence, and permanent run URLs.
- **Recovery and idempotency:** sequence-based SSE resume, event deduplication, idempotent run/fork creation, and interrupted-run convergence.
- **Demo-to-development path:** a 90-second recorded demo with no infrastructure requirements, plus deterministic and live-model sandbox modes.

See [CHANGELOG.md](./CHANGELOG.md) for the complete release history.

## Execution modes

| Mode | Tool execution | Requirements |
| --- | --- | --- |
| Recorded replay | No; deterministic run bundle | None |
| Deterministic sandbox | Real `read/search/patch/test` tools | PostgreSQL and Docker |
| Live-model sandbox | Real allowlisted tools; model selects structured actions | PostgreSQL, Docker, API key |

The UI labels these modes explicitly. A missing database, Docker daemon, or provider key never blocks the recorded demo.

## Highlights

- Generic `RunExecutor`, validated `DecisionProvider`, `ToolRegistry`, and isolated workspace boundary
- Fixed `buggy-auth-api` scenario with server-owned commands and patch allowlists
- Non-root, network-disabled Docker test runner with CPU, memory, PID, and timeout limits
- Immutable parent runs, checkpoint snapshots, and copy-on-write child forks
- Trace tree, timeline, replay controls, span inspector, and permanent run URLs
- Diff and log artifact viewers with PostgreSQL persistence and secret redaction
- No-progress loop detection using normalized calls plus workspace and test-result hashes
- Evidence-linked `Resolved / Regressed / Trade-off` comparison and code-fix evaluation
- Sequence-based SSE recovery and idempotent run/fork creation
- Legacy code-audit workbench retained at `/audit`

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and select **Start 90-second demo**. No key or infrastructure is required.

For local sandbox execution:

```bash
docker compose up -d
# Copy .env.example to .env.local
npm run db:migrate
npm run dev
```

Set:

```bash
DATABASE_URL=postgresql://agentscope:agentscope@localhost:54329/agentscope
DEEPSEEK_API_KEY=
MINIMAX_API_KEY=
```

Provider secrets are server-only and are excluded from traces, artifacts, and exported bundles.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run eval
npm run build
npm run e2e
npm audit --omit=dev
```

For the PostgreSQL integration suite, set `TEST_DATABASE_URL` explicitly before
running `npm run test:postgres`. Docker sandbox tests require
`TEST_DOCKER_SANDBOX=1`.

AgentScope is intentionally a modular monolith and a portfolio-grade fixed-scenario sandbox. It does not execute arbitrary user repositories and does not claim multi-tenant production isolation.

## License

[MIT](./LICENSE)
