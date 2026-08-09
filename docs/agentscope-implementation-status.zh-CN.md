# AgentScope 实现状态

更新时间：2026-08-09
当前版本：v0.3.4

## 已完成：AI 产品经理作品集体验

- 首页以用户问题、四步产品流程、关键决策、验证结果与个人贡献为主叙事
- 90 秒演示只展示当前决策，未来步骤锁定，完整技术证据按需展开
- `step`、`details=brief` 与 `details=trace` 支持刷新、分享和中英文切换，旧 URL 保持兼容
- 验证完成后可生成中英文产品复盘摘要，复制或下载 Markdown，并跳转到对应证据
- `/workbench` 承载本地沙箱和高级技术入口，`/runs/:runId` 继续提供完整运行详情
- Case Study 明确区分产品目标、当前验证、实现取舍和技术可信度
- README 提供三分钟可读的完整项目说明，不再把执行模式和架构放在主叙事前面

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

## 已完成：求职展示与公开部署

- `recorded_only` Production Profile 与 `SANDBOX_DISABLED` 失败关闭
- 可操作的 `Failure → Root cause → Fork → Verified fix` 引导
- Parent/Child 测试、错误、重复调用、Token、延迟和工具调用摘要
- `/case-study` 产品案例与首页/Header 入口
- recorded-only Production Smoke 与公开 Artifact 读取验证
- 首页、Demo、Compare、Eval、Case Study 的 axe 严重问题门禁
- Lighthouse Performance ≥ 90、Accessibility ≥ 95、LCP ≤ 2.5 秒和 Console Error 预算
- 自动录屏脚本、双语介绍、简历 Bullet、3/10 分钟讲稿与面试 FAQ
- 双语 60 至 90 秒产品演示视频与 GitHub Release 展示入口
- Open Graph、Twitter、robots、sitemap 和 1200×630 社交分享图

## 执行模式状态

| 模式 | 状态 | 说明 |
| --- | --- | --- |
| Recorded + Fixture | 可用 | 无外部依赖，确定性 Parent/Child 运行包 |
| Sandbox + Fixture | 可用 | 需要 PostgreSQL 与 Docker，真实执行固定工具 |
| Sandbox + DeepSeek | 可用 | 额外需要 `DEEPSEEK_API_KEY` |
| Sandbox + MiniMax | 可用 | 额外需要 `MINIMAX_API_KEY` |

线上 Vercel Production 固定使用 `recorded_only`；`local_sandbox` 只用于可信本地环境。

## 已知边界

- 只执行内置案例，不接受用户仓库、上传代码或客户端测试命令。
- 幂等映射当前是进程内登记，稳定 Run ID 与数据库唯一约束共同防止重复写；多实例生产环境需迁移到共享幂等表。
- 能力探测用于作品集降级，不等同于持续健康检查。
- PostgreSQL 是单项目开发基线，当前没有身份认证、Project ACL 或多租户隔离。
- Live Provider 的非确定性只影响决策；工具集合与安全策略始终由服务端控制。
- Eval 是版本化确定性规则，不评价隐藏推理质量。
