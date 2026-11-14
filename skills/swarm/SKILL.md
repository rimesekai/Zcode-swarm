---
name: swarm
description: >-
  蜂群模式（移植自 Google Antigravity 的 /swarm）：一条目标拉起一支多智能体小队——领队拆解任务、
  独立评审把关、多个工人在隔离工作区并行施工，工人之间走信箱互通消息、可上报后续任务回流队列（动态生命周期），
  对抗性验证员逐个把关、合并分支后跑集成回归门禁、最后领队终审，产出任务看板、消息板与执行报告。
  当用户说「/swarm」「swarm 模式」「蜂群模式」「多智能体并行」「开一支小队来干」，
  或明确要求把一个大任务拆给多个 agent 同时做时使用。目标含糊先澄清；几分钟内单人能完成的小任务不要用。
argument-hint: "<目标> [--agents N] [--isolation auto|worktree|shared] [--interactive] [--model <模型id>]"
---

# Swarm 模式

把一个总目标交给多智能体小队执行。编排逻辑在本技能自带的 saved workflow `swarm`（`workflow/swarm.dwf.ts`）：领队拆解 → 独立评审拆解方案 →（`--interactive` 时人工确认）→ 工人并行施工（git worktree 隔离或范围分区）→ 对抗性验证员逐个把关（失败打回修复，至多 3 轮）→ 工人上报的后续任务经领队分流回流队列 → 合并员合并分支 → 集成回归门禁 → 领队终审，产出看板、消息板、计划卡片与执行报告。

## 0. 安装自检（每次开跑前执行）

编排脚本作为 saved workflow 安装在用户全局目录 `~/.zcode/workflows/swarm.dwf.ts`。插件/仓库分发不带全局安装，所以先自检：

1. 调用 `ListSavedWorkflows`，确认存在名为 `swarm` 的全局 workflow 且带 4 个参数（goal/agents/interactive/isolation）。
2. 不存在、或缺参数（说明用户全局目录里是旧版本）时：把**本技能目录下** `workflow/swarm.dwf.ts`（技能加载时 ZCode 会报告技能基目录，脚本就在基目录的 `workflow/` 子目录里）复制为 `~/.zcode/workflows/swarm.dwf.ts`（文件工具直接写绝对路径即可，目标目录不存在则先创建），然后重新 `ListSavedWorkflows` 确认。
3. 用户全局目录里另有同名旧版 workflow 时，覆盖前先把它备份为 `swarm.dwf.<旧版本说明>.bak.ts` 并告知用户。

自检通过后再继续下面的流程。

## 1. 先判断值不值得开 swarm

- **适用**：宽泛/大型任务——跨模块功能开发、多方向并行调研、批量迁移、需要"改-测-修"循环的改造。
- **不适用**：5 分钟内单人能完成的小修小改。此时直接自己做，并向用户说明为什么不值得开小队（省 token）。
- **目标含糊**（不知道改什么/验收标准不明）：先用提问把目标、范围、验收标准问清楚，再继续。

## 2. 解析参数

`$ARGUMENTS` 形如 `<目标> [--agents N] [--isolation auto|worktree|shared] [--interactive] [--model <模型id>]`：

- **目标**（必填）：缺了就问，不要猜。
- **--agents**：并行工人数，默认 4，上限 10。任务天然分几块就给几。
- **--isolation**：默认 `auto`——git 仓库自动用 worktree 隔离（每任务独立工作树，通过验证后合并），否则共享工作区+范围分区。用户显式给了就用用户的；非 git 仓库却指定 worktree 会自动回退 shared。
- **--interactive**：加了这个开关时，工作流会在「拆解方案确认后」和「收尾合并前」各设一个停点（hole），运行到那里会停下来等用户给调整意见；没加则全程自动，只保留工人/验证员的 escalate 提问通路。
- **--model**：把整个 swarm（含领队/验证员）切到指定模型，通过 CreateWorkflow 的 `subagent_model` 字段传入（值用完整 `providerId/modelId`，可从 ListModels 查）。

## 3. 开跑

1. 先用 Skill 工具加载 `dynamic-workflows` 技能（CreateWorkflow 的前置要求）。
2. **git status 预检**：若工作区有未提交改动且将用 worktree 模式，提醒用户——worktree 基于 HEAD 拉出，工人看不到未提交的改动；建议先提交或改用 `--isolation shared`。
3. 调用 `CreateWorkflow`：`saved: { name: "swarm", args: { goal, agents, isolation, interactive } }`；用户给了 `--model` 时在同一次调用上加 `subagent_model`。没指定的参数不要传（用默认值）。
4. 开跑前用一句话告知用户：将并行跑 N 个工人 + 每任务一个对抗验证员，token 消耗明显高于单 agent；确认窗口里可以直接取消或改配置。

## 4. 运行期间与收尾

- **不要轮询**运行状态，等完成通知；期间用户问起用 GetWorkflowRun 看一眼再转述。
- **改需求/砍任务**：用户中途想改目标、砍掉某个任务或调整方向时，用 AmendWorkflow 改脚本继续跑（已完成的工作从缓存零成本导入），不要从头重来。没有单独"杀掉某个工人"的原语——砍任务一律走 AmendWorkflow。
- **interactive 停点**：`--interactive` 模式下运行会在两个 hole 停下等输入；用户给意见后用 FillWorkflowHole 填写调整逻辑（可增删改任务/调整合并清单），其余任务继续跑。**注意：hole 填充体会被永久写进全局 workflow 文件（带 body 的 hole 不再停等），填完如属一次性调整，记得把 body 摘除恢复未填充形态，并检查 `/* zcode-workflow */` 元数据头仍在。**
- 运行出错（provider 停止、脚本错误）时按 dynamic-workflows 的恢复流程处理（ResolveWorkflowQuestion / AmendWorkflow / ResumeWorkflowRun），不要从头重来。
- 结束后向用户汇报：结论、已通过/未过验证/受阻的任务数、值得注意的 findings 和 notCovered，以及需要用户亲自做的事（共享模式下 `git diff` 审阅后提交等）。

## 5. 运行期产物

- **任务看板**：每张卡实时反映 待执行/执行中/验证中/修复中/已完成/受阻/未过验证。
- **进度指标**：已完成/执行中/验证中/修复中/未过验证/受阻/总任务，按任务实际阶段精确统计。
- **消息板**：工人之间信箱通信的实时流水（谁→谁、说了什么）。工人只在 ask 边界收到投递，进行中的工人下一轮才能读到消息。
- **计划卡片 / 执行报告**：拆解方案与最终结果，报告含每任务结局、合并、回归、信箱摘录与终审。

## 注意

- **信箱协议**：工人只写自己的信箱 `.swarm/board/<任务id>.md`，条目以「## 」开头；`[@对方任务id]` 定向捎话，`[@all]` 广播，不写 @ 是工作日志。脚本在 ask 边界收割投递，并把消息实时投到消息板卡片。**脚本每次运行会清空 `.swarm/board/` 重置信箱**；结束时 `.swarm/` 整体保留（现场与消息板可用于复盘）——建议把 `.swarm/` 加进目标项目的 `.gitignore`。
- **动态生命周期**：工人会把施工中发现的必需后续工作写进 `followUps` 上报，领队分流后回流任务队列继续执行（嵌套上限 2 层，总量上限为初始任务数的 2 倍）。后续收编的 code 任务在 worktree 模式下同样会建独立工作树（与初始任务同一套清理+创建流程），创建失败会响亮回退共享模式并记入报告。后续任务的 worktree 基于 main HEAD，看不到其他任务未合并的改动——依赖时用 `git show swarm/<任务id>:<路径>` 只读参考。
- **worktree 残留自动清理**：每次建树前按 worktree remove → 目录兜底删 → prune → 删残留分支的顺序清理（顺序不能反：分支被残留 worktree 占用时删不掉）；清理后仍创建失败的任务会响亮回退共享模式并记入报告。
- **集成回归门禁**：合并后在主工作区跑领队从仓库探得的全量构建/测试命令；失败打回修复一轮，仍失败计 high 级 finding。领队没找到可信命令时门禁跳过并在报告注明。
- **共享模式（shared / 非 git 仓库）**：工人不做任何 git 写操作，改动以未提交状态留在工作区；worktree 模式下合并与清理由合并员完成，失败任务现场保留在 `.swarm/`。结束时的"工作区不干净"检查会过滤 `.swarm/` 与各任务声明的产出，只报非预期改动。
- **验证循环封顶 3 轮**；仍未通过的改动不会被合并（worktree 模式），会在报告里如实标注。
- 工人的文件写入依赖会话权限模式；受限权限模式下先建议用户切换到自动模式再开 swarm。
