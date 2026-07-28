# HarnessLab 架构说明

## 1. 设计目标

HarnessLab 的目标不是提供另一个聊天窗口，而是回答代码 Agent 产品中的四个
工程问题：

1. 输入是否经过约束和标准化？
2. Agent 执行了哪些阶段，每一步何时发生？
3. Finding 是否有证据、位置和可执行建议？
4. 不同 Provider 的结果能否使用同一套标准评估和导出？

## 2. 边界划分

### Provider 层

Provider 只负责调用模型并返回 `summary`、`riskScore` 和 `findings`。DeepSeek
与 MiniMax 共用 `openai-compatible.ts`，各自文件仅维护地址、环境变量和默认
模型，减少重复逻辑。

### Harness 层

`lib/audit/run-audit.ts` 是核心编排器，负责：

- 解析输入并生成内容哈希
- 产生六阶段 Trace
- 调用 Provider 并记录耗时
- 运行确定性 Eval
- 生成 Markdown 报告和完整 JSON Trace
- 通过 Async Generator 向 API 暴露事件

### API 层

`POST /api/audit` 同时支持 JSON 和 SSE。浏览器使用 SSE 持续接收阶段事件；
测试或其他客户端仍可直接获得普通 JSON。

`POST /api/github/pr` 只解析公开 GitHub PR 地址，再映射到固定 GitHub API
地址。该限制用于避免服务端任意 URL 请求风险。

### Client 层

客户端只管理输入状态、实时事件合并、结果展示、下载和 localStorage。它不持有
模型密钥，也不计算审计质量分数。

## 3. Eval Card

Eval Card 衡量审计过程质量，不代表代码本身的绝对质量。当前分数完全由确定性
规则计算：

- `reproducibility`：Provider 路径和固定 Prompt 版本是否可复现
- `traceability`：阶段完成度、Finding 证据和位置覆盖
- `testability`：建议是否具体以及测试规则是否得到响应
- `confidence`：结构化完整度、审查强度和 Provider 类型
- `score`：以上指标的算术平均值

这套规则可以版本化、测试和解释，模型无法直接修改自己的分数。

## 4. 流式协议

SSE 事件共有三种：

```text
trace  -> 单个 AgentEvent，可按 id 更新现有阶段
result -> 完整 AuditResponse，审计成功结束
error  -> 结构化错误信息
```

每个事件包含稳定阶段 ID、状态、时间戳，并可记录 artifact 与 duration。

## 5. 安全边界

- API Key 仅从服务端环境变量读取
- 输入最大 60,000 字符
- 模型输出通过 Zod 校验
- GitHub 导入仅允许 `https://github.com/{owner}/{repo}/pull/{number}`
- 报告是建议，不自动执行代码修改或合并操作
- localStorage 仅存审计结果，不存 API Key

## 6. 扩展方向

新增 Provider 时，应只实现 `ProviderAuditResult`，不要在 Provider 中生成 Trace
或 Eval。新增审查规则时，需要同步更新 Prompt、Mock 规则、评测用例和 UI 选项。
若未来接入私有仓库，应使用 GitHub App 或 OAuth，并将权限范围控制在只读。
