# AgentScope 求职展示材料

面向岗位：AI 产品经理、AI 应用产品经理、开发者工具产品经理。

## 一句话介绍

中文：AgentScope 是一个 Agent 失败回看与修复验证产品，帮助团队解释失败原因、安全创建新尝试，并用执行证据验证结果。

English: AgentScope helps agent teams explain failed runs, create safe new attempts and verify fixes with execution evidence.

## 简历 Bullet

- 从 Agent 失败后“日志太多但下一步不清楚”的问题出发，定义发现失败、解释原因、创建新尝试、验证结果的四步产品流程，并将完整技术控制台降级为按需证据层。
- 设计不可变原始尝试与独立新尝试机制，使用代码状态和测试结果识别无进展重复，让每条诊断和验证结论都能回到原始操作记录。
- 主导双语作品集、90 秒引导演示、安全沙箱与确定性验证的产品和全栈实现，并建立 E2E、可访问性、Lighthouse 与 recorded-only 发布门禁。

## 60 至 90 秒演示脚本

| 时间 | 画面与操作 | 讲解 |
| --- | --- | --- |
| 0-10s | 首页，点击“开始 90 秒演示” | “AgentScope 帮助团队看懂 Agent 为什么失败，并验证什么修复方法真的有效。” |
| 10-22s | 演示介绍，点击“开始查看失败” | “这是一个权限错误修复任务。完整技术日志暂时隐藏，我们只看当前需要做的决定。” |
| 22-36s | 查看简化执行路径 | “Agent 读取、搜索、修改并运行测试，但目标测试仍然失败。” |
| 36-50s | 点击“为什么会一直失败” | “它连续运行三次相同测试，代码状态和结果都没有变化。产品把它解释为无进展重复，原始规则可以按需展开。” |
| 50-65s | 创建新尝试并确认安全检查 | “新尝试从完整恢复位置开始，原始失败记录不会被覆盖，服务端继续控制文件和命令权限。” |
| 65-80s | 查看修复验证 | “目标测试通过，错误和重复操作消失，也没有检测到新回归。成本变化被放在权衡中单独说明。” |
| 80-90s | 展开完整技术证据或进入 Case Study | “产品负责人先看清决策，技术评审者仍能检查完整 Trace、对比和验证证据。” |

## 3 分钟项目介绍

我做 AgentScope 的起点是一个很具体的问题：Agent 的最终回答只能告诉我结果好不好，不能告诉我为什么失败。一个多工具 Agent 可能规划错误、调用工具失败、反复重试、状态没有变化，或者虽然最终成功却修改了范围外文件。

我把系统拆成执行、Trace、分析和展示四个边界。执行层由 `RunExecutor` 驱动，模型只能通过结构化 `DecisionProvider` 选择白名单动作。`ToolRegistry` 注册读文件、搜索、Patch 和测试；测试命令由服务端 Scenario Manifest 固定。每一步都产出追加写事件，再投影为 Run、Span、Artifact 与 Checkpoint。

旗舰案例里，Parent 修复策略错误，连续三次运行同一测试。仅比较工具输入会把普通重试误判成循环，所以诊断同时比较 Workspace Hash 和 Test Result Hash。三次调用输入相同、状态也相同，才生成版本化的 `no-progress-loop` 诊断，并附上证据 Span。

用户从首个安全测试 Span 发起 Fork。Checkpoint 保存 Fixture 版本、累计 Patch、工具版本和 Snapshot 引用。Child 使用 Copy-on-Write 恢复，Parent 事件与工作区不可变。修复完成后，Compare 只陈述 Resolved、Regressed 和 Trade-off；Eval 用确定性规则验证测试、Patch 范围、工具成功率与 Replay 安全，避免让另一个模型主观打分。

部署上我把可信边界说清楚：公开站点是 `recorded_only`，不探测 Docker，也不展示 Live Provider；本地 `local_sandbox` 才允许 PostgreSQL 和非 root、禁网、资源受限的 Docker 执行。这个版本没有执行任意仓库，因为那需要更强的供应链控制、租户隔离和异步 Worker 平面。

## 10 分钟架构深挖提纲

### 0–1 分钟：问题与成功标准

- 最终答案不能解释执行路径。
- 成功标准不是“显示日志”，而是失败可定位、分支可恢复、结果可验证、安全边界可说明。

### 1–3 分钟：统一执行与事件模型

- `RunExecutor` 只依赖 `DecisionProvider`、`ToolRegistry`、Workspace 与 Artifact 接口。
- Provider 输出经过 Zod 校验，不能注入 Shell。
- Trace Event 追加写，Projection 是 UI 和分析的共享事实源。
- SSE 以 sequence 续传，客户端按事件 ID 去重；进程中断会收敛到明确终态。

### 3–5 分钟：诊断设计

- 首次未恢复失败建立错误链起点。
- 重复调用签名包含规范化输入、Workspace Hash 与结果 Hash。
- `no-progress-loop` 是确定性规则，包含规则版本、置信度和证据 Span。
- 说明这种方法如何减少“合法重试”误报，以及 Hash 只能证明状态相同，不能证明语义正确。

### 5–7 分钟：Checkpoint 与不可变 Fork

- Checkpoint 内容：Fixture、Patch、工具版本、Snapshot 引用。
- Child Copy-on-Write 恢复；Parent 事件和 Artifact 不可修改。
- Replay Preflight 在执行前展示可执行范围与安全策略。
- Run/Fork 使用 Idempotency-Key，避免重试产生重复分支。

### 7–8.5 分钟：安全执行边界

- 固定 `buggy-auth-api`，Patch 只允许 `src/auth.ts`。
- 测试命令服务端固定，容器非 root、禁网、限制 CPU、内存、PID 和超时。
- Secret 在持久化前脱敏，Artifact 有类型、大小和 Run 总额限制。
- 公开环境 `recorded_only` 失败关闭，不配置数据库、Docker 或模型密钥。

### 8.5–10 分钟：验证、取舍与生产化

- Compare 不选单一赢家，只列 Resolved、Regressed、Trade-off。
- Eval 采用版本化确定性规则，所有结论链接到 Span。
- 当前模块化单体降低作品集部署复杂度。
- 当执行耗时超过请求生命周期、需要并发限流或多租户隔离时，再拆 Worker、队列与对象存储。

## 高频面试问题

### 为什么不用 LangSmith 或 Langfuse？

它们适合通用 tracing 与评测平台。这个项目的目标不是复刻功能表，而是深入实现失败恢复语义：状态 Hash 诊断、不可变 Checkpoint Fork、安全代码执行和证据化 Eval。生产项目中我会优先评估集成成熟平台，再决定哪些领域能力自建。

### 为什么使用确定性 Eval？

代码修复场景已经有可验证事实：测试是否通过、Patch 是否存在、是否越界、工具是否成功、是否重复无进展。确定性规则可复现、可版本化、成本低，也能直接链接 Span。LLM-as-a-Judge 更适合缺少客观判据的开放式质量维度，不应替代这些硬事实。

### Checkpoint 如何保证 Parent 不变？

Parent 的事件采用追加写，Fork 只读取目标 Span 前的 Checkpoint。Workspace Snapshot 被恢复到新的 Child 工作区，后续 Patch 和 Artifact 使用新的 Run ID。Compare 读取两个独立 Projection，不会回写 Parent。

### 为什么不能执行任意仓库？

未知仓库会引入安装脚本、依赖供应链、资源滥用、网络外泄和持久化攻击面。当前 Docker 策略只对固定 Manifest 做了可验证承诺。开放任意仓库前需要更强的 microVM 隔离、依赖策略、内容扫描、租户与数据保留设计。

### 如果生产化，什么时候拆 Worker 和队列？

当运行超过 Web 请求生命周期、需要可靠重试与背压、并发执行影响前台服务，或需要独立扩缩容和租户配额时拆分。届时 API 负责鉴权与创建任务，队列承载幂等消息，Worker 执行沙箱，PostgreSQL 保存元数据，对象存储保存大 Artifact。

## 视频发布清单

1. 启动 production build，并确认 `AGENTSCOPE_EXECUTION_PROFILE=recorded_only`。
2. 运行 `npm run record:demo`，视频输出在忽略目录 `output/videos/`。
3. 剪辑时保留 1440×900 画面，不展示本地密钥、终端路径或数据库连接串。
4. 上传视频后，将 README 中的 `VIDEO_URL` 和封面链接替换为真实地址。
5. 视频文件不提交 Git；发布前重新执行 Smoke、axe 和 Lighthouse。
