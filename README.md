<p align="center"><img src="assets/icon-512.png" width="128" alt="zcode-swarm 图标"/></p>

# zcode-swarm · 蜂群模式

> 一条目标，拉起一支多智能体小队。移植自 Google Antigravity 的 `/swarm`，为 [ZCode](https://github.com/zai-org/ZCode) 的 dynamic-workflows 运行时从零重实现。
>
> One goal, one swarm of agents. A from-scratch reimplementation of Google Antigravity's `/swarm` for ZCode's dynamic-workflows runtime.

说「/swarm 把登录模块重构掉」，就会拉起一支小队：领队拆解任务 → 独立评审把关 → 多个工人在 git worktree 里并行施工 → 对抗性验证员逐个实测把关 → 工人发现的后续工作自动回流队列 → 合并分支 → 跑全量回归 → 领队终审。全程有任务看板、进度指标和工人消息板，跑完交一份执行报告。

---

## 特性

- **确定性编排**：不是靠一个 prompt 祈祷，而是 dynamic-workflows 脚本编排的类型化多智能体流水线——每一步的输入输出都有 schema。
- **对抗性验证**：每个任务配一个专职验证员，逐条实测验收标准（能跑的命令真的跑、文件真的打开读），不过就打回，至多 3 轮；没过验证的改动不合并。
- **动态生命周期**：工人施工中发现"还缺一件事"时写进 `followUps` 上报，领队分流后回流任务队列继续执行（嵌套 ≤2 层，总量 ≤2× 初始任务数）。
- **信箱通信**：工人之间不共享上下文，但各有信箱（`.swarm/board/<任务id>.md`），`[@对方id]` 定向捎话、`[@all]` 广播，脚本在对话边界收割投递，消息实时投到消息板卡片。
- **隔离与合并**：git 仓库自动用 worktree（每任务独立工作树+分支，验证通过后 `--no-ff` 合并）；非 git 仓库回退共享工作区+scope 分区。残留现场自动清理。
- **集成回归门禁**：合并后在主工作区跑领队从仓库探得的全量构建/测试命令，失败打回修复一轮，仍失败计 high 级 finding。
- **可选人工停点**：`--interactive` 时在「拆解确认后」和「收尾合并前」各停一次，等你给意见；不开则全程自动，工人/验证员仍可 escalate 提问。
- **运行期可视化**：任务看板（7 列状态流）、精确进度指标、消息板流水、计划卡片、执行报告，全部是运行中的实时卡片。

## 安装 Install

**方式 A · 插件安装**：仓库内置 `.zcode-plugin/plugin.json`，可在本地添加为 ZCode 插件后直接启用 `zcode-swarm`。

**方式 B · 手动安装**（两个文件）：

```bash
# 1. 编排脚本 → 全局 workflows 目录
mkdir -p ~/.zcode/workflows
cp skills/swarm/workflow/swarm.dwf.ts ~/.zcode/workflows/swarm.dwf.ts

# 2. 技能 → 用户技能目录
mkdir -p ~/.zcode/skills
cp -r skills/swarm ~/.zcode/skills/swarm
```

装好后技能会在每次开跑前自检 `ListSavedWorkflows`，缺了或版本不对会自动从技能目录补装/覆盖（旧版会先备份）。

## 使用 Usage

```
/swarm <目标> [--agents N] [--isolation auto|worktree|shared] [--interactive] [--model <模型id>]
```

| 参数 | 说明 |
|---|---|
| 目标（必填） | 一句话说清做什么、验收标准是什么 |
| `--agents` | 并行工人数，默认 4，上限 10 |
| `--isolation` | `auto`（默认：git 仓库自动 worktree，否则共享+分区）/ `worktree` / `shared` |
| `--interactive` | 开启两个运行中人工停点（拆解确认后、收尾合并前） |
| `--model` | 整支小队切换模型（完整 `providerId/modelId`） |

**开跑前会提示 token 消耗**：N 个工人 + 每任务一个验证员 + 回归门禁，明显高于单 agent。5 分钟能干完的小活别开小队。

## 已实测范围与已知未实测路径

以下结论来自 **4 轮真实端到端运行**（worktree / shared+纯调研 / followUps 回流+interactive / 最终版闭环）+ 5 份固定逻辑回归脚本：

**已实测 ✅**：worktree 隔离→验证→合并→清理全链路；残留分支/目录自动清理（含清理顺序反转 bug 的修复验证）；脏工作区警告与非预期文件过滤；shared 模式与 scope 分区；followUps 上报→领队分流→后续任务建 worktree→三合一并；`--interactive` 两个停点的真实停等与填充；信箱 @路由（含 `[@all]` 在条目任意位置的容错）；集成回归门禁通过路径；metrics 精确统计；计划卡/报告一致性。

**零自然触发 ⚠️**（代码存在、逻辑经审查，但 4 轮里 0 次真实发生——模型太守规矩）：
- 对抗验证打回的**修复轮**（`rounds > 1`）
- `blocked` / `escalate` 收尾路径
- `git merge` 冲突的解决流程
- 集成回归失败后的「集成修复员」循环
- 多工人并发上报 followUps 触发 `maxTotal` 上限截断（竞态防护已按 `reserveSlot`/`dispatch` 两步实现并审查，未压测）

遇到其中任何一条真实触发后行为不符预期，欢迎提 issue 附执行报告。

## `.swarm/` 目录

- `.swarm/board/`：工人信箱（每次运行开工时**清空重置**），结束保留供复盘。
- `.swarm/<任务id>/`：worktree 模式下各任务的独立工作树，合并成功后自动移除；失败任务的现场保留。
- 建议把 `.swarm/` 加进目标项目的 `.gitignore`；脚本结尾的工作区干净检查会自动过滤 `.swarm/` 与各任务声明的产出。

## Examples

[`examples/`](examples/) 收录真实运行的完整执行报告：

- [`report-run3-followups-interactive.md`](examples/report-run3-followups-interactive.md)：followUps 回流 + interactive 停点 + 三分支合并（含验证员用 `git show swarm/tool:src/tool.js` 跨分支实测的记录）
- [`report-run1-worktree-basic.md`](examples/report-run1-worktree-basic.md)：基础 worktree 模式，验证员字节级核对断言

## Related work

- [marcopesani/swarm-skill](https://github.com/marcopesani/swarm-skill)：同概念（lead + worktree 工人 + 审计），实现路线不同——外部 `pi` 进程跑 OpenRouter 便宜模型 + SQLite 消息板，面向 Claude Code/Codex/pi 等 75+ agent；本项目用 ZCode 原生 dynamic-workflows 扇出，零外部依赖，多独立对抗验证员与实时看板/消息板。
- [wjgoarxiv/antigravity-swarm](https://github.com/wjgoarxiv/antigravity-swarm)（已改名 LitGravity）：名字相近但不是 swarm——是给 Antigravity CLI 加"计划→测试→评审→交接"工作纪律的包。本项目取名 `zcode-swarm` 以避免混淆。

---

## English

**zcode-swarm** turns one goal into a swarm of agents: a lead decomposes the goal → an independent critic reviews the plan → workers implement in parallel inside git worktrees → an adversarial verifier tests each task against its acceptance criteria (up to 3 rounds, unverified changes are never merged) → worker-discovered follow-up tasks flow back into the queue through lead triage → branches are merged → a full regression gate runs → the lead audits everything. Live kanban board, precise metrics, a worker message board, and a final execution report are published as run artifacts.

**Install** (manual): copy `skills/swarm/workflow/swarm.dwf.ts` to `~/.zcode/workflows/swarm.dwf.ts` and `skills/swarm/` to `~/.zcode/skills/swarm`. The skill self-checks and repairs the global workflow copy on every run.

**Usage**: `/swarm <goal> [--agents N] [--isolation auto|worktree|shared] [--interactive] [--model <providerId/modelId>]`

**Honestly-tested scope**: verified over 4 real end-to-end runs (worktree isolation/merge/cleanup, shared+research mode, followUp requeue + nested worktree, interactive stops, mailbox @-routing, regression gate, live dashboards) plus 5 fixed-logic regression snippets. **Never fired in real runs** (implemented and reviewed, 0 natural occurrences): verification fix rounds (`rounds > 1`), `blocked`/`escalate` endings, merge-conflict resolution, the regression-repair loop, and concurrent followUps hitting the `maxTotal` cap. If any of these misbehaves in your use, please open an issue with the execution report attached.

**`.swarm/`**: worker mailboxes (`.swarm/board/`, reset at every run) and per-task worktrees (removed after successful merge). Add `.swarm/` to your project's `.gitignore`.

Design inspired by Google Antigravity's `/swarm`; all orchestration code and prompts were written from scratch for ZCode. MIT licensed.

---

## 致谢 Acknowledgements

设计灵感来自 Google Antigravity 的 `/swarm` 命令；编排逻辑、提示词与全部代码为本项目为 ZCode 从零重实现，未复制原作任何文本或代码。

## License

[MIT](LICENSE)
