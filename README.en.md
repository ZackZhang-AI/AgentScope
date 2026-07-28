# HarnessLab

[中文说明](./README.md) | [Architecture (Chinese)](./docs/architecture.zh-CN.md)

HarnessLab is a Code Agent Audit Workbench that turns diffs, file snippets, and
public GitHub pull requests into observable audit traces, structured findings,
deterministic process-quality scores, and review-ready reports.

It is not a generic chat wrapper. Models produce findings; the Harness owns
validation, orchestration, trace events, evaluation, metrics, and exports.

![HarnessLab desktop workbench](./public/harnesslab-desktop.png)

## Features

- Real-time SSE trace across six audit stages
- AgentScope black-box Trace Explorer with replay, diagnostics, branching, and Run comparison
- PostgreSQL event persistence, sequence-based SSE resumption, and interrupted-run recovery
- Versioned Run Bundle import/export and deterministic analysis persistence
- Mock, DeepSeek, and MiniMax providers
- Security, reliability, testing, maintainability, and performance rules
- Public GitHub pull request import
- Server-side Zod validation and model JSON recovery
- Provider latency, token usage, and prompt-version metrics
- Deterministic Eval Card generated outside the model
- Markdown, JSON, and pull-request comment exports
- Versioned browser localStorage session history
- Reproducible mock evaluation suite enforced by CI

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Mock Demo requires no API key.

AgentScope documentation:

- [Product requirements](./docs/agentscope-prd.zh-CN.md)
- [Implementation status](./docs/agentscope-implementation-status.zh-CN.md)
- [Operations and security](./docs/agentscope-operations.zh-CN.md)

Optional `.env.local` values:

```bash
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
MINIMAX_API_KEY=
MINIMAX_MODEL=MiniMax-M2.7
GITHUB_TOKEN=
```

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run eval
npm run build
npm run e2e
```

## License

[MIT](./LICENSE)
