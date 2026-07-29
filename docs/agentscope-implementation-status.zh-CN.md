# AgentScope 实现状态

更新时间：2026-07-29
当前版本：v0.3.0

## 已完成：代码修复黑匣子闭环

- 通用多工具 `RunExecutor`、结构化 `DecisionProvider` 与工具注册表
- Fixture、DeepSeek、MiniMax 三种决策来源
- 固定 `buggy-auth-api` 场景与真实 `read/search/patch/test` 工具
- 临时工作区、路径穿越防护、Patch 白名单和 Docker 资源边界
- PostgreSQL Artifact 迁移、内容限制、脱敏、Hash 与内部 Snapshot
- Parent 不可变、Checkpoint 恢复、Copy-on-Write Child Fork
- Workspace Hash + Test Result Hash 驱动的 `no_progress_loop`
- 首次失败到重复循环再到 Run 终态的证据链
- 代码修复专项 Eval 与 `Resolved / Regressed / Trade-off` Compare
- 90 秒无 Key 演示、真实沙箱入口、Live Provider 能力检测
- Run 深链接、SSE 刷新恢复、Artifact Diff/Log Viewer
- 桌面与移动端旗舰流程 E2E
- 原 `/api/audit` 与 `/audit` 代码审计工作台兼容保留

## 执行模式状态

| 模式 | 状态 | 说明 |
| --- | --- | --- |
| Recorded + Fixture | 可用 | 无外部依赖，确定性 Parent/Child 运行包 |
| Sandbox + Fixture | 可用 | 需要 PostgreSQL 与 Docker，真实执行固定工具 |
| Sandbox + DeepSeek | 可用 | 额外需要 `DEEPSEEK_API_KEY` |
| Sandbox + MiniMax | 可用 | 额外需要 `MINIMAX_API_KEY` |

## 已知边界

- 只执行内置案例，不接受用户仓库、上传代码或客户端测试命令。
- 幂等映射当前是进程内登记，稳定 Run ID 与数据库唯一约束共同防止重复写；多实例生产环境需迁移到共享幂等表。
- 能力探测用于作品集降级，不等同于持续健康检查。
- PostgreSQL 是单项目开发基线，当前没有身份认证、Project ACL 或多租户隔离。
- Live Provider 的非确定性只影响决策；工具集合与安全策略始终由服务端控制。
- Eval 是版本化确定性规则，不评价隐藏推理质量。
