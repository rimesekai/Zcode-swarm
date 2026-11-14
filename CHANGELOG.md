# Changelog

## 0.1.0（2026-11-15）

首发版本。基于 v2 原型全量重写为 v3 架构，经 4 轮真实端到端运行与 5 份固定逻辑回归验证。

### 新增

- 动态生命周期：`channel` + counted close 任务队列；工人 `followUps` 上报经领队分流回流队列（嵌套 ≤2 层、总量 ≤2× 初始任务数）；后续 code 任务同样建独立 worktree。
- 信箱通信：`.swarm/board/<任务id>.md`，`[@任务id]` 定向 / `[@all]` 广播 / 无标记日志；脚本在 ask 边界收割投递；消息实时投到「消息板」table artifact（mid 幂等去重）；每次运行开工前重置信箱。
- `--interactive`：拆解确认后与收尾合并前各设一个 hole 停点。
- 集成回归门禁：合并后由「集成回归员」跑 `gateCommands`，失败打回「集成修复员」修一轮。
- 运行期产物：任务看板（7 列）、精确 metrics（执行中/验证中/修复中分列）、消息板、计划卡片、执行报告。

### 修复（相对 v2 原型，共 16 项）

- blocked 结局漏更新 metrics；「验证中」改为按任务阶段精确统计。
- 计划卡片与实际执行任务列表不一致（截断/id 规范化后不一致）。
- worktree 残留清理顺序反转（先删分支会被残留 worktree 占用而失败）；残留目录 node 兜底清理；创建失败响亮回退共享并记入报告。
- 开工时脏工作区警告 + notCovered + 计划卡横幅。
- 结尾 git status 期望路径过滤（`.swarm/` 前缀 + 未跟踪目录折叠形态）。
- 收编循环 maxTotal 竞态（reserveSlot 占位与检查零 await）。
- 信箱条目 `[@...]` 位置容错（任意位置首次出现即路由）。
- 后续任务父分支可见性说明（`git show swarm/<id>:<路径>` 只读参考）。
- `tasks`/`mergeable` 可在 interactive 停点重新赋值。
- isolation 参数 CRLF 污染防御。
- 其余见 README「已实测范围与已知未实测路径」。
