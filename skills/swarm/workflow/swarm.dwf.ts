/* zcode-workflow
description: Antigravity 式蜂群 v3：领队拆解 → 独立评审 →（interactive 时人工确认）→ 工人并行施工（git worktree 隔离或范围分区）→ 对抗性验证员逐个把关（不过打回修复）→ 工人可上报后续任务、经领队分流回队列继续执行（动态生命周期）→ 工人之间信箱 @定向通信 → 合并分支 → 集成回归门禁 → 领队终审。全程任务看板 + 精确进度指标 + 消息板，产出实施计划卡片与执行报告。
whenToUse: 用户点名 swarm 模式/蜂群模式/多智能体并行，或 /swarm 技能转发来的大型宽泛任务；几分钟内单人能完成的小任务不要用；下载类任务受外部 API 限流制约，不建议并行工人直接打源站。
args:
  agents:
    type: number
    description: 并行工人数（1–10，默认 4）
    default: 4
  goal:
    type: string
    description: 要完成的总目标，一句话说清做什么、验收标准是什么
    required: true
  interactive:
    type: boolean
    description: 在拆解方案确认后与收尾前各设一个人工停点（hole），运行到那里会停下来等调整意见
    default: false
  isolation:
    type: string
    description: 隔离方式：auto（git 仓库自动 worktree，否则共享+分区）/ worktree / shared
    default: auto
*/
interface Task {
  /** 唯一短 id：小写字母/数字/连字符，如 auth、docs。 */
  id: string;
  /** 任务标题，给人看的中文短语。 */
  title: string;
  /** 交给工人的完整任务说明：做什么、产出什么、注意什么。工人看不到其他任务，上下文要写全。 */
  brief: string;
  /** code=要改代码/文件；research=只调研并写小结文件。 */
  kind: "code" | "research";
  /** 该任务允许创建或修改的文件/目录（workspace 相对路径）。 */
  scope: string[];
  /** 可实测的验收标准，每条一句话。 */
  acceptance: string[];
}

interface Plan {
  /** 对目标的理解与总体思路，两三句话。 */
  approach: string;
  /** 拆解出的子任务，数量不超过要求的工人个数。 */
  tasks: Task[];
  /** 全体工人/验证员需要的公共信息：构建与测试命令、目录约定、风格要求。 */
  notes: string[];
  /** 合并后集成回归要跑的全量构建/测试命令（从仓库实际探得；没有可信命令就空数组）。 */
  gateCommands: string[];
}

interface FollowUp {
  /** 后续工作标题。 */
  title: string;
  /** 交给工人的完整说明：做什么、产出什么、注意什么。 */
  brief: string;
  /** code=要改代码/文件；research=只调研并写小结文件。 */
  kind: "code" | "research";
  /** 允许创建或修改的文件/目录（workspace 相对路径）。 */
  scope: string[];
  /** 可实测的验收标准，每条一句话。 */
  acceptance: string[];
}

interface WorkResult {
  /** done=全部完成；partial=部分完成；blocked=被阻塞无法推进。 */
  status: "done" | "partial" | "blocked";
  /** 一两句话总结做了什么。 */
  summary: string;
  /** 改动或产出的文件（workspace 相对路径）。 */
  changedFiles: string[];
  /** 给验证员和领队的话：自测结果、遗留问题、阻塞原因。 */
  notes: string;
  /** 施工中发现的、目标达成所必需的后续工作；没有就留空数组。 */
  followUps?: FollowUp[];
}

interface Verdict {
  /** 是否通过全部验收标准。 */
  pass: boolean;
  /** 未通过时逐条列出问题；通过时为空数组。 */
  issues: string[];
  /** 验证证据：跑了什么命令、读了什么文件、看到什么关键输出。 */
  evidence: string;
}

interface Critique {
  /** 评审是否通过（没有实质问题）。 */
  ok: boolean;
  /** 未通过时逐条列出会让工人失败或产出不合格的问题；通过时为空数组。 */
  issues: string[];
}

interface WorkItem {
  task: Task;
  /** 0=领队拆解的初始任务；1+=工人上报、经领队分流的后续任务。 */
  depth: number;
}

interface TriageDecision {
  /** 对应上报列表的下标（0 起）。 */
  index: number;
  /** 是否收编进队列继续执行。 */
  approve: boolean;
  /** 一句话理由。 */
  reason: string;
}

interface Triage {
  /** 逐条处置结果，与上报列表一一对应。 */
  decisions: TriageDecision[];
}

interface TaskOutcome {
  id: string;
  title: string;
  /** 已完成=通过对抗验证；未过验证=实测没过；受阻=无法推进。 */
  status: "已完成" | "未过验证" | "受阻";
  summary: string;
  changedFiles: string[];
  rounds: number;
  issues: string[];
  evidence: string;
  /** 该任务干活时所在的独立工作树（worktree 模式才有）。 */
  worktree?: string;
}

interface MergeResult {
  /** 已成功合并进主工作区的任务 id。 */
  merged: string[];
  /** 跳过或失败的任务与原因。 */
  skipped: { id: string; reason: string }[];
  /** worktree 与分支的清理情况说明。 */
  cleanup: string;
}

interface GateCommandResult {
  /** 执行的命令（原样）。 */
  cmd: string;
  /** 进程退出码；无法执行时填 -1。 */
  exitCode: number;
  /** 一句话：结果或无法执行的原因。 */
  note: string;
}

interface Regression {
  /** 全部命令是否都通过（退出码全 0）。 */
  pass: boolean;
  /** 每条命令的结果。 */
  commands: GateCommandResult[];
  /** 未通过时的要点汇总。 */
  issues: string[];
}

interface RepairResult {
  /** 修了什么，一两句话。 */
  summary: string;
  /** 改动的文件（workspace 相对路径）。 */
  changedFiles: string[];
}

interface AuditFinding {
  /** 位置：文件路径或任务 id。 */
  where: string;
  /** 一句话：问题是什么，或有什么值得注意。 */
  what: string;
  /** low=小瑕疵；medium=需要用户关注；high=崩溃/数据损失/错误结果。 */
  severity: "low" | "medium" | "high";
}

interface Audit {
  /** 两三句话：目标整体完成得怎么样。 */
  summary: string;
  /** 终审发现的问题与风险。 */
  findings: AuditFinding[];
  /** 没能覆盖或验证的部分及原因。 */
  notCovered: string[];
}

interface Finding {
  /** 位置：文件路径（必要时带行号）或任务 id。 */
  where: string;
  /** 一句话：问题是什么，或发现了什么。 */
  what: string;
  /** 依据：验证员跑的命令/读的文件，或终审的观察。 */
  evidence: string;
  /** verified=独立验证员或命令确认过；unconfirmed=终审观察、未经第二双眼睛确认。 */
  status: "verified" | "unconfirmed";
  /** low=小瑕疵；medium=需要用户关注；high=崩溃/数据损失/错误结果。 */
  severity: "low" | "medium" | "high";
}

interface WorkflowReport {
  /** 两三句话回答：这个目标完成得怎么样。 */
  conclusion: string;
  findings: Finding[];
  /** 本次运行实际做过的检查与操作。 */
  verified: string[];
  /** 没覆盖或无法检查的部分及原因。 */
  notCovered: string[];
  /** 每个任务的结局明细。 */
  tasks: TaskOutcome[];
}

// ---------- 固定逻辑（已用 EvalWorkflowSnippet 验证） ----------

/** 信箱内容按「## 」标题切成条目；首个标题前的内容是序言，忽略。 */
function parseEntries(content: string): string[] {
  const parts = content.split(/^## /m);
  return parts.slice(1).map((p) => p.trim()).filter((p) => p !== "");
}

/** 解析条目的定向标记：[@目标id] 或 [@all]，条目内首次出现即生效；没有标记就是工作日志。 */
function parseMention(text: string): { to: string | null; body: string } {
  const m = /\[@([a-z0-9_\-]+)\]/.exec(text);
  if (m === null) return { to: null, body: text };
  const body = (text.slice(0, m.index) + " " + text.slice(m.index + m[0].length)).replace(/\s+/g, " ").trim();
  return { to: m[1], body: body };
}

/** 规范化任务 id：小写、非法字符转连字符、折叠连续连字符、去首尾连字符。 */
function normalizeId(raw: string, fallback: string): string {
  let id = String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  if (id === "") id = fallback;
  return id;
}

/** 结尾工作区状态检查时，判断一个路径是否属于本次运行的预期产出。 */
function isExpected(path: string, expectedFiles: Set<string>): boolean {
  if (path.startsWith(".swarm/")) return true;
  if (expectedFiles.has(path)) return true;
  // git 会把整个未跟踪目录折叠成 "dir/" 形式：目录下任一预期文件命中即算预期
  if (path.endsWith("/")) {
    for (const f of expectedFiles) {
      if (f.startsWith(path)) return true;
    }
  }
  return false;
}

// ---------- 参数 ----------

const goal = String(args.goal ?? "").trim();
if (goal === "") throw new Error("缺少 goal 参数：swarm 需要知道要完成的目标。");

const workerCount = Math.max(1, Math.min(10, typeof args.agents === "number" ? Math.floor(args.agents) : 4));
const isoArg = String(args.isolation ?? "auto").trim().toLowerCase();
const interactive = args.interactive === true;

// ---------- 运行时旋钮（改这里，不要改进 ask 文本——ask 文本是缓存键） ----------

const VERIFY_ROUNDS = 3; // 每个任务验证+修复的封顶轮数
const MAX_DEPTH = 2; // 后续任务最多嵌套几层（初始任务 depth=0）
const MAILBOX_DIR = ".swarm/board"; // 工人信箱目录（workspace 相对路径）

// ---------- 看板 / 指标 / 消息板 ----------

artifact.metrics("metrics", {
  title: "Swarm 进度",
  metrics: [
    { field: "done", label: "已完成" },
    { field: "executing", label: "执行中" },
    { field: "verifying", label: "验证中" },
    { field: "fixing", label: "修复中" },
    { field: "failed", label: "未过验证" },
    { field: "blocked", label: "受阻" },
    { field: "total", label: "总任务" },
  ],
});

artifact.board("board", {
  title: "Swarm 任务看板",
  key: "id",
  status: "status",
  columns: ["待执行", "执行中", "验证中", "修复中", "已完成", "受阻", "未过验证"],
  cardTitle: "title",
  detail: [
    { field: "rounds", label: "验证轮次" },
    { field: "files", label: "变更文件" },
    { field: "summary", label: "摘要" },
  ],
});

artifact.table("messages", {
  title: "Swarm 消息板",
  key: "mid",
  columns: [
    { field: "from", label: "来自" },
    { field: "to", label: "投递给" },
    { field: "text", label: "内容" },
  ],
});

// ---------- 领队拆解目标 ----------

phase("领队拆解目标");
// 每次运行重置信箱目录：上一轮的消息不应泄漏进本轮的消息板（任务 id 跨运行复用时会撞车）
await world.run("node", ["-e", "require('fs').rmSync(process.argv[1], {recursive: true, force: true})", MAILBOX_DIR]);
let insideRepo = false;
try {
  const probe = await world.run("git", ["rev-parse", "--is-inside-work-tree"]);
  insideRepo = probe.exitCode === 0 && probe.stdout.trim() === "true";
} catch {
  insideRepo = false;
}
const useWorktree = isoArg === "shared" ? false : insideRepo;
if (!insideRepo && isoArg !== "shared") log("当前工作区不是 git 仓库：worktree 隔离不可用，改用共享工作区+范围分区。");
if (isoArg !== "auto" && isoArg !== "worktree" && isoArg !== "shared") log(`isolation 参数「${isoArg}」无法识别，按 auto 处理。`);

let dirtyAtStart = false;
try {
  const st0 = await git.status();
  dirtyAtStart = !st0.clean;
} catch {
  // 非 git 仓库：git 门面调用会拒绝，降级为无状态
}
if (dirtyAtStart && useWorktree) {
  log("⚠ 工作区有未提交改动：worktree 基于 HEAD 拉出，工人看不到这些改动。建议先提交再跑，或改用 --isolation shared。");
}

const lead = agent("领队");
let plan = await lead.ask<Plan>(
  `你是 swarm 团队的领队（Lead）。把下面的总目标拆成不超过 ${workerCount} 个、可并行执行的子任务。\n\n` +
    `总目标：${goal}\n\n` +
    `并行隔离方式：${useWorktree ? "git worktree——每个 code 任务会分到一个独立工作树，可以放心同时改代码，合并由专门的合并员负责" : "共享工作区——所有人改同一批文件，必须给每个任务划出互不重叠的文件范围 scope，连新建文件的路径也要错开"}\n\n` +
    `要求：\n` +
    `1. 先自己看一眼当前工作区的结构（目录、README、构建脚本），让拆解贴合实际，不要凭空假设。\n` +
    `2. 每个任务必须自包含：工人看不到其他任务，brief 里要把背景、做法、产出写全。\n` +
    `3. scope 用 workspace 相对路径；${useWorktree ? "worktree 模式下 scope 用于说明验收范围" : "共享模式下各任务的 scope 绝对不能重叠"}。\n` +
    `4. acceptance 每条都要可实测：能跑命令的写成命令级标准（如「node tests/x.test.js 输出 OK」），不能跑的写成可读核对的标准。\n` +
    `5. notes 里写上工人和验证员需要的公共信息：构建/测试命令、目录约定、代码风格。\n` +
    `6. 纯调研类任务标 kind=research，产出为一到几份小结文件（路径写进 scope）；要改代码/文件的标 kind=code。\n` +
    `7. 确实不需要 ${workerCount} 个任务时可以少拆，但不要硬凑。\n` +
    `8. 多个任务的产出最终要合并进一份总报告时，在 notes 里统一各任务的输出格式（文件格式、列名/字段、语言、统计口径），避免各写各的导致对不上。\n` +
    `9. gateCommands：从仓库实际探得的全量构建/测试命令（合并后在主工作区跑，用作集成回归门禁，如「npm test」「make check」）；没有可信的命令就留空数组，不要编造。`,
);
if (plan.tasks.length === 0) throw new Error("领队没有拆出任何任务，无法继续。");

// ---------- 独立评审拆解方案 ----------

phase("独立评审拆解方案");
const critic = agent("方案评审员", {
  system:
    "你是拆解方案的独立评审员：从零审查领队的拆解，只找真实会让工人失败或产出不合格的问题。" +
    "亲自查看工作区核实后逐条列问题；方案确实没有实质问题就 ok=true，不要为了挑而挑。" +
    "你没有修改权。所有文字用简体中文。",
});
for (let round = 1; round <= 2; round++) {
  const critique = await critic.ask<Critique>(
    `独立评审这份拆解方案（第 ${round} 轮）。总目标：${goal}

` +
      `拆解方案：${JSON.stringify(plan)}

` +
      `隔离方式：${useWorktree ? "git worktree（每任务独立工作树）" : "共享工作区+范围分区"}

` +
      `审查要点：
1. 每个任务是否自包含（工人看不到其他任务，brief 是否写全背景与做法）；
` +
      `2. scope 是否互不重叠、是否覆盖目标要求的全部产出；
3. acceptance 是否可实测；
` +
      `4. 任务数量与并行度是否合理；
5. 是否遗漏公共约定（构建/测试命令、目录、输出格式）；
6. gateCommands 是否真实存在（不确定可以亲自跑一下验证，不要修改文件）。
` +
      `可以亲自查看工作区核实。不要修改任何文件。`,
  );
  if (critique.ok) {
    log(`方案评审第 ${round} 轮通过，无实质问题。`);
    break;
  }
  log(`方案评审第 ${round} 轮发现 ${critique.issues.length} 个问题，退回领队修订。`);
  plan = await lead.ask<Plan>(
    `评审员没有通过你的拆解方案（第 ${round} 轮评审）。总目标：${goal}\n\n` +
      `评审问题：\n- ${critique.issues.join("\n- ")}\n\n原方案：${JSON.stringify(plan)}\n\n` +
      `请修订：任务数量保持不超过 ${workerCount}，逐条修好以上问题后重新输出完整 Plan（字段结构不变，gateCommands 重新核实）。`);
  if (plan.tasks.length === 0) throw new Error("修订后的方案没有任何任务，无法继续。");
}

// 截断 + id 规范化（计划卡片、看板、报告一律以此为准）
const usedIds = new Set<string>();
let tasks: Task[] = plan.tasks.slice(0, workerCount).map((t, i) => {
  let id = normalizeId(String(t.id ?? ""), `task-${i + 1}`);
  if (usedIds.has(id)) id = `${id}-${i + 1}`;
  usedIds.add(id);
  return {
    id: id,
    title: String(t.title ?? `任务 ${i + 1}`),
    brief: String(t.brief ?? ""),
    kind: t.kind === "research" ? "research" : "code",
    scope: Array.isArray(t.scope) ? t.scope.map(String) : [],
    acceptance: Array.isArray(t.acceptance) && t.acceptance.length > 0 ? t.acceptance.map(String) : ["按说明完成后可核对"],
  };
});
if (plan.tasks.length > tasks.length) log(`领队拆出了 ${plan.tasks.length} 个任务，超过工人上限 ${workerCount}，只执行前 ${tasks.length} 个。`);

const gateCommands: string[] = Array.isArray(plan.gateCommands)
  ? plan.gateCommands.map(String).filter((c) => c.trim() !== "")
  : [];

// interactive：人工确认拆解方案（fill 可按用户意见增删改 tasks）
if (interactive) {
  await hole<void>(
    "确认拆解方案",
    `拆解已完成并通过独立评审，共 ${tasks.length} 个任务（隔离：${useWorktree ? "git worktree" : "共享工作区+范围分区"}）：\n` +
      tasks.map((t) => `- ${t.id} · ${t.title}【${t.kind === "code" ? "改代码/文件" : "调研"}】`).join("\n") +
      `\n\n总体思路：${plan.approach}\n` +
      `如需增删改任务，回复调整意见（我会改写任务列表后继续）；回复「继续」则按原计划执行。`,
  );
}

await artifact.markdown(
  "plan",
  [
    "# Swarm 实施计划",
    "",
    `**目标**：${goal}`,
    "",
    `**总体思路**：${plan.approach}`,
    "",
    ...(dirtyAtStart && useWorktree
      ? ["**⚠ 开工时工作区有未提交改动**：worktree 基于 HEAD 拉出，工人看不到这些改动。建议先提交，或改用 shared 模式重跑。", ""]
      : []),
    `**集成回归命令**：${gateCommands.length > 0 ? gateCommands.map((c) => "`" + c + "`").join("、") : "（领队未发现可信的全量测试命令，回归门禁跳过）"}`,
    "",
    `**公共注意事项**：`,
    ...(plan.notes.length > 0 ? plan.notes.map((n) => `- ${n}`) : ["- 无"]),
    ...(plan.tasks.length > tasks.length
      ? ["", `> 领队拆出 ${plan.tasks.length} 个任务，超出工人上限 ${workerCount}，只执行前 ${tasks.length} 个。`]
      : []),
    "",
    `**子任务**：`,
    ...tasks.map(
      (t) =>
        `### ${t.id} · ${t.title}【${t.kind === "code" ? "改代码/文件" : "调研"}】
` +
        `- 说明：${t.brief}
- 范围：${t.scope.join("、") || "按说明判断"}
- 验收：
${t.acceptance.map((a) => `  - ${a}`).join("\n")}`,
    ),
  ].join("\n"),
  { title: "Swarm 实施计划", description: "领队拆解并经独立评审通过的任务计划" },
);

// ---------- 创建隔离工作树（先清残留再建） ----------

/** 为一个 code 任务准备独立工作树：先清残留（worktree→目录→分支，顺序不能反——分支被残留 worktree 占用时删不掉），再创建；失败响亮回退共享并返回 undefined。 */
async function setupWorktree(id: string): Promise<string | undefined> {
  // 残留 worktree：已注册的由 remove 拆掉，目录已消失的注册项由 prune 清掉
  await world.run("git", ["worktree", "remove", "--force", `.swarm/${id}`]);
  await world.run("node", ["-e", "require('fs').rmSync(process.argv[1], {recursive: true, force: true})", `.swarm/${id}`]);
  await world.run("git", ["worktree", "prune"]);
  // 此时不再有 worktree 占用分支，删除才可能成功
  const brCheck = await world.run("git", ["rev-parse", "--verify", "--quiet", `refs/heads/swarm/${id}`]);
  if (brCheck.exitCode === 0) {
    const del = await world.run("git", ["branch", "-D", `swarm/${id}`]);
    if (del.exitCode === 0) log(`任务 ${id}：清掉上次运行残留的分支 swarm/${id}`);
    else log(`任务 ${id}：残留分支 swarm/${id} 删除失败：${del.stderr.slice(-200)}`);
  }
  let add = await world.run("git", ["worktree", "add", "-b", `swarm/${id}`, `.swarm/${id}`], { output: { tail: 4096 } });
  if (add.exitCode !== 0) {
    // 并发创建可能撞锁：等 1 秒重试一次
    await world.run("node", ["-e", "setTimeout(() => process.exit(0), 1000)"]);
    add = await world.run("git", ["worktree", "add", "-b", `swarm/${id}`, `.swarm/${id}`], { output: { tail: 4096 } });
  }
  if (add.exitCode === 0) {
    log(`任务 ${id} → 独立工作树 .swarm/${id}（分支 swarm/${id}）`);
    return `.swarm/${id}`;
  }
  log(`任务 ${id} 的 worktree 创建失败（清理残留后仍失败），该任务回退共享模式：${add.stderr.slice(-300)}`);
  return undefined;
}

const wtPaths: Record<string, string | undefined> = {};
const worktreeFallbacks: string[] = [];
if (useWorktree) {
  phase("创建隔离工作树");
  await world.run("git", ["worktree", "prune"]);
  for (const t of tasks) {
    if (t.kind !== "code") continue;
    const wt = await setupWorktree(t.id);
    if (wt !== undefined) wtPaths[t.id] = wt;
    else worktreeFallbacks.push(t.id);
  }
}

// ---------- 任务队列（动态生命周期：工人上报的后续任务回流进队列） ----------

const queue = channel<WorkItem>("任务队列");
let open = 0; // 已发出且未收尾的任务数；归零时关队列（counted close）
let enqueuedTotal = 0;
let fuSeq = 0;
const maxTotal = tasks.length * 2; // 含后续任务的总封顶
const allTaskIds: string[] = [];
const enqueuedIds = new Set<string>();
const pendingTitles: Record<string, string> = {};
const phaseOf = new Map<string, string>(); // 进行中任务 → 执行中|验证中|修复中
const outcomes = new Map<string, TaskOutcome>();

function metricsTick(): void {
  let exec = 0;
  let ver = 0;
  let fix = 0;
  for (const v of phaseOf.values()) {
    if (v === "执行中") exec += 1;
    else if (v === "验证中") ver += 1;
    else if (v === "修复中") fix += 1;
  }
  let done = 0;
  let failed = 0;
  let blocked = 0;
  for (const o of outcomes.values()) {
    if (o.status === "已完成") done += 1;
    else if (o.status === "未过验证") failed += 1;
    else if (o.status === "受阻") blocked += 1;
  }
  report({ done: done, executing: exec, verifying: ver, fixing: fix, failed: failed, blocked: blocked, total: enqueuedTotal }, "metrics");
}

function finalize(outcome: TaskOutcome): void {
  outcomes.set(outcome.id, outcome);
  phaseOf.delete(outcome.id);
  report(
    { id: outcome.id, title: outcome.title, status: outcome.status, rounds: outcome.rounds, files: outcome.changedFiles.join("、"), summary: outcome.summary },
    "board",
  );
  report(outcome);
  metricsTick();
}

/** 占位：登记任务元数据与总量计数。检查与占位之间绝不能隔 await，否则并发分流会突破 maxTotal。 */
function reserveSlot(task: Task, depth: number): void {
  allTaskIds.push(task.id);
  enqueuedIds.add(task.id);
  pendingTitles[task.id] = task.title;
  enqueuedTotal += 1;
  report(
    { id: task.id, title: task.title, status: "待执行", rounds: 0, files: "", summary: depth > 0 ? "后续任务（工人上报，经领队分流）" : "" },
    "board",
  );
}

/** 入队：占位之后（可能隔了 worktree 准备等 await）真正把任务放进队列。 */
function dispatch(task: Task, depth: number): void {
  open += 1;
  queue.send({ task: task, depth: depth });
}

function enqueue(task: Task, depth: number): void {
  reserveSlot(task, depth);
  dispatch(task, depth);
}

function settle(): void {
  open -= 1;
  if (open === 0) queue.close();
}

/** 收割信箱：读所有已知任务的信箱，把 [@我] / [@all]（或 collectAll 时全部条目）返回为投递行。 */
async function harvestFor(selfId: string, delivered: Record<string, number>, collectAll: boolean): Promise<string[]> {
  const lines: string[] = [];
  for (const id of allTaskIds) {
    if (id === selfId) continue;
    let content: string;
    try {
      content = await files.read(`${MAILBOX_DIR}/${id}.md`);
    } catch {
      continue; // 对方还没写信箱
    }
    const entries = parseEntries(content);
    const start = delivered[id] ?? 0;
    for (let i = start; i < entries.length; i += 1) {
      const parsed = parseMention(entries[i]);
      if (collectAll || parsed.to === selfId || parsed.to === "all") {
        lines.push(`[${id} → ${parsed.to ?? "日志"}] ${parsed.body}`);
      }
      report({ mid: `${id}:${i}`, from: id, to: parsed.to === null ? "（日志）" : parsed.to, text: parsed.body.slice(0, 300) }, "messages");
    }
    delivered[id] = entries.length;
  }
  return lines;
}

// 种子任务入队
for (const t of tasks) {
  enqueue(t, 0);
}
log(`Swarm 开工：${tasks.length} 个初始任务入队，${workerCount} 个并行工人，隔离 = ${useWorktree ? "git worktree" : "共享工作区+范围分区"}。`);

const workerSystem =
  "你是 swarm 团队里的工人（Worker），独立负责一个子任务，看不到其他工人的对话，靠信箱互通消息。" +
  "规则：1) 只创建或修改授权范围内的文件，绝不碰范围外的东西；" +
  "2) 完成后按验收标准自测，能跑的命令真的跑；" +
  "3) 如实汇报：没做完报 partial，被卡住报 blocked 并写清原因，绝不假装完成；" +
  "4) 如果任务说明与实际情况矛盾、或在给定范围内根本无法完成，把矛盾如实写进 notes，不要擅自越界绕过；" +
  "5) 施工中发现的、目标达成所必需的后续工作（缺失的公共文件、相邻的缺口、其他任务依赖的准备），写进 followUps 上报给领队分流，不要擅自越界去做；" +
  "6) 与队友通信只走信箱：只写你自己的信箱文件（.swarm/board/你的任务id.md，主工作区相对路径），条目以「## 」开头；正文第一行写 [@对方任务id] 定向捎话，[@all] 广播全体，不写 @ 就是自己的工作日志；绝不改别人的信箱文件；" +
  "7) 如果矛盾大到不向上说清楚就没法继续（验收标准自相矛盾、必需的文件或工具不存在），用 escalate 上报，而不是编造假结果。" +
  "所有文字用简体中文。";
const verifierSystem =
  "你是 swarm 团队里的对抗性验证员（Verifier）：职责是找出问题，而不是认同工人。" +
  "对照验收标准逐条实测：能跑的命令真的跑（构建、测试、脚本），文件改动真的打开读，输出真的核对。" +
  "不要因为工人声称完成就通过。如果验收标准本身有问题、或客观上无法验证，如实写进 issues，不要硬判；" +
  "如果验收标准自相矛盾到无法出具任何有意义的结论，用 escalate 向上说明。" +
  "你没有修改权：绝不编辑任何文件。所有文字用简体中文。";

// ---------- 工人并行施工，验证员逐个把关 ----------

const consumerStage = future(async () => {
  phase("工人并行施工，验证员逐个把关");

  async function processItem(item: WorkItem, delivered: Record<string, number>): Promise<void> {
    const t = item.task;
    const wt = wtPaths[t.id];
    try {
      report({ id: t.id, title: t.title, status: "执行中", rounds: 0, files: "", summary: "" }, "board");
      phaseOf.set(t.id, "执行中");
      metricsTick();

      const worker = agent(`工人·${t.id}`, { system: workerSystem });
      const scopeLine = t.scope.length > 0 ? t.scope.join("、") : "按任务说明自行判断，但不得超出任务所需";
      const firstMail = await harvestFor(t.id, delivered, false);
      const workAsk =
        `你的任务「${t.title}」（任务 id：${t.id}）。总目标背景：${goal}\n\n` +
        `${plan.notes.length > 0 ? "公共注意事项：" + plan.notes.join("；") + "\n\n" : ""}` +
        `任务说明：${t.brief}\n\n` +
        `允许触碰的范围：${scopeLine}\n` +
        `验收标准：\n- ${t.acceptance.join("\n- ")}\n\n` +
        (useWorktree && item.depth > 0
          ? `你是后续任务：你的 worktree 基于 main HEAD，其他任务尚未合并的改动不在其中。若 brief 提到依赖其他任务的产出，用 git show swarm/<任务id>:<路径> 只读参考；绝不 checkout 或修改别人的分支与工作区。\n\n`
          : "") +
        (wt !== undefined
          ? `你的工作目录是 ${wt}（workspace 相对路径）：文件读写与命令都先 cd 到该目录内进行，绝不碰目录外的文件——唯一例外是按下面协议写你自己的信箱。完成后在其中提交：git add -A && git commit -m "swarm(${t.id}): ${t.title}"。`
          : `你在主工作区干活：不要执行任何 git 写操作（add/commit/checkout 等），把改动留在工作区即可；不要碰范围外的文件。`) +
        `\n\n信箱协议：你的信箱文件是 ${MAILBOX_DIR}/${t.id}.md，必须用文件编辑工具按主工作区相对路径写入（不要用 shell 重定向按当前目录拼路径）` +
        (wt !== undefined
          ? `；如果你在 worktree 的 shell 里（cwd 是 ${wt}），shell 中等价路径是 ../../${MAILBOX_DIR}/${t.id}.md`
          : "") +
        `。每条以「## 」开头的一行做标题；想给队友捎话，在条目里写 [@对方任务id]，想广播写 [@all]。开工和收工时各写一条进展。\n\n` +
        (firstMail.length > 0 ? `开工前，信箱里投递给你的消息：\n- ${firstMail.join("\n- ")}\n\n` : "") +
        `完成后如实汇报 WorkResult：没做完报 partial，被卡住报 blocked 并写清原因；有新发现的后续工作写进 followUps。`;
      let work = await worker.ask<WorkResult>(workAsk);

      if (work.status === "blocked") {
        finalize({
          id: t.id,
          title: t.title,
          status: "受阻",
          summary: work.summary,
          changedFiles: work.changedFiles,
          rounds: 0,
          issues: [work.notes !== "" ? work.notes : "工人报告被阻塞"],
          evidence: "",
          worktree: wt,
        });
        return;
      }

      const verifier = agent(`验证员·${t.id}`, { system: verifierSystem });
      let rounds = 0;
      let passed = false;
      let lastIssues: string[] = [];
      let lastEvidence = "";
      while (rounds < VERIFY_ROUNDS) {
        rounds += 1;
        phaseOf.set(t.id, "验证中");
        report({ id: t.id, title: t.title, status: "验证中", rounds: rounds, files: work.changedFiles.join("、"), summary: work.summary }, "board");
        metricsTick();
        const verdict = await verifier.ask<Verdict>(
          `对抗性验证任务「${t.title}」（第 ${rounds} 轮）。总目标背景：${goal}\n\n` +
            `工人汇报：${JSON.stringify(work)}\n\n` +
            `验收标准：\n- ${t.acceptance.join("\n- ")}\n\n` +
            (wt !== undefined
              ? `改动都在 ${wt} 内：到那里读文件、在那里跑命令（先 cd ${wt}）。`
              : `改动在主工作区，按范围检查：${scopeLine}。`) +
            `\n逐条实测：能跑的命令真的跑，文件真的打开读，输出真的核对。不要修改任何文件。`,
        );
        lastIssues = verdict.issues;
        lastEvidence = verdict.evidence;
        if (verdict.pass) {
          passed = true;
          break;
        }
        if (rounds >= VERIFY_ROUNDS) break;
        phaseOf.set(t.id, "修复中");
        report({ id: t.id, title: t.title, status: "修复中", rounds: rounds, files: work.changedFiles.join("、"), summary: work.summary }, "board");
        metricsTick();
        const mail = await harvestFor(t.id, delivered, false);
        work = await worker.ask<WorkResult>(
          `验证员没有通过你的任务「${t.title}」（第 ${rounds} 轮验证）。问题：\n- ${verdict.issues.join("\n- ")}\n` +
            `${verdict.evidence !== "" ? "验证证据：" + verdict.evidence + "\n\n" : ""}` +
            (mail.length > 0 ? `信箱里投递给你的消息：\n- ${mail.join("\n- ")}\n\n` : "") +
            `请在你的工作目录内修复以上问题${wt !== undefined ? "，修复后 git add -A && git commit" : ""}，然后重新如实汇报 WorkResult（有新的后续工作发现也写进 followUps）。`,
        );
        if (work.status === "blocked") break;
      }

      // 后续任务分流：先 open++ 收编进队列，再收尾父任务（保证计数不变量）
      const fups: FollowUp[] = Array.isArray(work.followUps) ? work.followUps : [];
      if (fups.length > 0 && !passed) {
        log(`任务 ${t.id} 上报了 ${fups.length} 条后续工作，但任务未通过验证，忽略。`);
      } else if (fups.length > 0 && item.depth >= MAX_DEPTH) {
        log(`任务 ${t.id} 上报了 ${fups.length} 条后续工作，已达嵌套上限（depth=${item.depth}），忽略。`);
      } else if (fups.length > 0 && enqueuedTotal >= maxTotal) {
        log(`任务 ${t.id} 上报了 ${fups.length} 条后续工作，已达任务总量上限 ${maxTotal}，忽略。`);
      } else if (fups.length > 0) {
        const triage = await lead.ask<Triage>(
          `工人刚完成「${t.title}」（${t.id}），上报了以下后续工作。总目标：${goal}\n\n` +
            `当前任务列表（含已完成与进行中）：${JSON.stringify(allTaskIds.map((id) => ({ id: id, title: pendingTitles[id] ?? id })))}\n\n` +
            `上报列表：${JSON.stringify(fups)}\n\n` +
            `逐条判断：approve=收编进队列继续执行（必须是目标达成所必需、不与已有任务重复、范围可独立执行且不与已有 scope 冲突）；reject 给一句话理由。输出 decisions，与上报列表一一对应。\n` +
            `注意：后续任务的 worktree 基于 main HEAD 拉出，看不到其他任务尚未合并的改动。如果后续工作依赖某任务刚写出的文件，在 brief 里写明该文件在分支 swarm/<那个任务id> 上，工人可用 git show swarm/<任务id>:<路径> 只读参考；纯依赖已合并内容的才能直接做。`,
        );
        for (const d of triage.decisions) {
          if (typeof d.index !== "number" || !Number.isInteger(d.index) || d.index < 0 || d.index >= fups.length) continue;
          const fu = fups[d.index];
          if (fu === undefined || fu === null) continue;
          if (d.approve !== true) {
            log(`后续工作 #${d.index} 未收编：${d.reason}`);
            continue;
          }
          // 并发分流下其他工人可能刚入队过任务，入队前再查一次上限（硬约束）
          if (enqueuedTotal >= maxTotal) {
            log(`已达任务总量上限 ${maxTotal}，后续工作 #${d.index}（${String(fu.title ?? "")}）未收编。`);
            break;
          }
          fuSeq += 1;
          const base = normalizeId(`${t.id}-r${fuSeq}`, `followup-${fuSeq}`);
          let fid = base;
          let suffix = 1;
          while (enqueuedIds.has(fid)) {
            fid = `${base}-${suffix}`;
            suffix += 1;
          }
          const ft: Task = {
            id: fid,
            title: String(fu.title ?? `后续任务 ${fuSeq}`),
            brief: String(fu.brief ?? ""),
            kind: fu.kind === "research" ? "research" : "code",
            scope: Array.isArray(fu.scope) ? fu.scope.map(String) : [],
            acceptance: Array.isArray(fu.acceptance) && fu.acceptance.length > 0 ? fu.acceptance.map(String) : ["按说明完成后可核对"],
          };
          // 先原子占位（检查与占位之间无 await），再去做带 await 的 worktree 准备，否则并发分流会突破 maxTotal
          reserveSlot(ft, item.depth + 1);
          if (useWorktree && ft.kind === "code") {
            try {
              const fwt = await setupWorktree(fid);
              if (fwt !== undefined) wtPaths[fid] = fwt;
              else worktreeFallbacks.push(fid);
            } catch (err) {
              worktreeFallbacks.push(fid);
              log(`后续任务 ${fid} 的 worktree 准备异常，回退共享模式：${String(err).slice(0, 200)}`);
            }
          }
          log(`领队收编后续任务 ${fid}（来自 ${t.id}）：${ft.title}`);
          dispatch(ft, item.depth + 1);
        }
      }

      if (passed) {
        finalize({ id: t.id, title: t.title, status: "已完成", summary: work.summary, changedFiles: work.changedFiles, rounds: rounds, issues: [], evidence: lastEvidence, worktree: wt });
      } else if (work.status === "blocked") {
        finalize({ id: t.id, title: t.title, status: "受阻", summary: work.summary, changedFiles: work.changedFiles, rounds: rounds, issues: [work.notes !== "" ? work.notes : "修复阶段被阻塞"], evidence: lastEvidence, worktree: wt });
      } else {
        finalize({ id: t.id, title: t.title, status: "未过验证", summary: work.summary, changedFiles: work.changedFiles, rounds: rounds, issues: lastIssues, evidence: lastEvidence, worktree: wt });
      }
    } catch (error) {
      finalize({
        id: t.id,
        title: t.title,
        status: "受阻",
        summary: `执行链异常：${String(error).slice(0, 200)}`,
        changedFiles: [],
        rounds: 0,
        issues: [String(error).slice(0, 300)],
        evidence: "",
        worktree: wt,
      });
    } finally {
      settle();
    }
  }

  await Promise.all(
    Array.from({ length: workerCount }, async (_, k) => {
      const delivered: Record<string, number> = {}; // 每个消费者自己的已投递记账，避免并发收割重复投递
      for await (const item of queue) {
        await processItem(item, delivered);
      }
    }),
  );
});
await consumerStage;

// ---------- 收尾：收割全部信箱 →（interactive）确认 → 合并 → 回归 → 终审 ----------

const barrierMail = await harvestFor("", {}, true);
const digest = barrierMail.length > 0 ? barrierMail.join("\n").slice(0, 4000) : "";

let mergeable: TaskOutcome[] = [];
for (const id of allTaskIds) {
  const o = outcomes.get(id);
  if (o !== undefined && o.status === "已完成" && o.worktree !== undefined) mergeable.push(o);
}

// interactive：收尾前人工确认（fill 可按用户意见调整 mergeable）
if (interactive) {
  const doneCount0 = [...outcomes.values()].filter((o) => o.status === "已完成").length;
  const failCount0 = [...outcomes.values()].filter((o) => o.status === "未过验证").length;
  const blockedCount0 = [...outcomes.values()].filter((o) => o.status === "受阻").length;
  await hole<void>(
    "收尾前确认",
    `全部任务已出结果：已完成 ${doneCount0} / 未过验证 ${failCount0} / 受阻 ${blockedCount0}（共 ${enqueuedTotal} 个）。\n` +
      (useWorktree && mergeable.length > 0
        ? `接下来：合并 ${mergeable.length} 个分支（${mergeable.map((o) => o.id).join("、")}）→ ${gateCommands.length > 0 ? "集成回归" : "（无回归门禁）"} → 领队终审。`
        : `接下来：${gateCommands.length > 0 ? "集成回归 → " : ""}领队终审。`) +
      `\n回复意见（如「跳过任务 X 不合并」）或「继续」。`,
  );
}

let merge: MergeResult | null = null;
if (useWorktree && mergeable.length > 0) {
  phase("合并各分支并清理现场");
  const merger = agent("合并员");
  merge = await merger.ask<MergeResult>(
    `把以下已通过对抗验证的任务分支合并进当前主工作区（cwd）：\n` +
      mergeable
        .map((o) => `- 任务 ${o.id}：worktree=${o.worktree}，分支 swarm/${o.id}，改动：${o.changedFiles.join("、") || "（以分支为准）"}`)
        .join("\n") +
      `\n\n对每个任务：\n` +
      `1. 先 git -C <worktree> status --porcelain：有未提交改动就在该 worktree 里 git add -A && git commit -m "swarm(<id>): 补交"；\n` +
      `2. git merge --no-ff swarm/<id> -m "swarm: 合并任务 <id>"；\n` +
      `3. 出现冲突就编辑解决后 git add 并完成 merge commit。\n\n` +
      `注意：主工作区里可能还有共享模式任务的未提交改动（那是预期交付，不要 add/commit 它们）；.swarm/ 目录（含 ${MAILBOX_DIR}/ 信箱）不算脏，也不要提交或删除。\n\n` +
      (digest !== "" ? `工人信箱里值得你注意的消息：\n${digest}\n\n` : "") +
      `全部处理完后清理现场：每个成功合并的任务执行 git worktree remove <worktree> 和 git branch -d swarm/<id>（-d 被拒就用 -D，并在汇报里说明原因）；合并失败的任务保留现场，什么都不要删。\n` +
      `最后用 git status --porcelain 确认主工作区（忽略 .swarm/ 与共享任务的预期改动）没有意外改动。如实汇报 MergeResult。`,
  );
  log(`合并：成功 ${merge.merged.length} 个，跳过 ${merge.skipped.length} 个。${merge.cleanup}`);
}

let regression: Regression | null = null;
let repair: RepairResult | null = null;
if (gateCommands.length > 0) {
  phase("全量回归测试");
  const regressor = agent("集成回归员", {
    system:
      "你是集成回归员：在主工作区按清单逐条执行命令，如实报告每条的退出码与关键输出。" +
      "绝不修改任何文件。命令无法执行（不存在/环境不具备）时在 note 里如实说明并记 exitCode=-1。所有文字用简体中文。",
  });
  regression = await regressor.ask<Regression>(
    `逐条执行以下命令（在主工作区根目录跑），如实回报：\n${gateCommands.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\n` +
      `每条记录：命令、退出码、一句话结果（附关键输出片段）。全部退出码为 0 则 pass=true。绝不修改任何文件。`,
  );
  if (!regression.pass) {
    log(`集成回归未通过（${regression.issues.length} 个要点），打回修复一轮。`);
    const fixer = agent("集成修复员", {
      system:
        "你负责修复多任务合并后的集成问题：只修导致回归失败的最小问题，不扩大改动范围。" +
        "完成后如实汇报改了哪些文件。所有文字用简体中文。",
    });
    repair = await fixer.ask<RepairResult>(
      `集成回归没有通过：\n- ${regression.issues.join("\n- ")}\n\n命令结果：${JSON.stringify(regression.commands)}\n\n` +
        `请在主工作区修复以上集成问题，然后如实汇报 RepairResult（summary 与 changedFiles）。`,
    );
    regression = await regressor.ask<Regression>(
      `修复后请逐条重跑全部命令并如实回报（格式同上）：\n${gateCommands.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
    );
    log(`修复后回归：${regression.pass ? "通过" : "仍未通过"}。`);
  }
}

// ---------- 领队终审与汇总 ----------

phase("领队终审与汇总");
let stClean: boolean | null = null;
let stUnstaged: string[] = [];
let stUntracked: string[] = [];
let stBranch = "（无）";
try {
  const st = await git.status();
  stClean = st.clean;
  stUnstaged = st.unstaged;
  stUntracked = st.untracked;
  stBranch = st.branch ?? "（游离 HEAD）";
} catch {
  // 非 git 仓库：git 门面调用会拒绝，降级为无状态
}

const expectedFiles = new Set<string>();
for (const id of allTaskIds) {
  const o = outcomes.get(id);
  if (o !== undefined) {
    for (const f of o.changedFiles) expectedFiles.add(f);
  }
}
if (repair !== null) {
  for (const f of repair.changedFiles) expectedFiles.add(f);
}
const unexpectedUnstaged = stUnstaged.filter((p) => !isExpected(p, expectedFiles));
const unexpectedUntracked = stUntracked.filter((p) => !isExpected(p, expectedFiles));
const stText =
  stClean === null
    ? "（当前工作区不是 git 仓库，没有 git 状态可查）"
    : `branch=${stBranch}，clean=${stClean}，未暂存 ${stUnstaged.length} 个文件（非预期 ${unexpectedUnstaged.length} 个），未跟踪 ${stUntracked.length} 个文件（非预期 ${unexpectedUntracked.length} 个）`;

const orderedOutcomes: TaskOutcome[] = [];
for (const id of allTaskIds) {
  const o = outcomes.get(id);
  if (o !== undefined) orderedOutcomes.push(o);
}
const outcomeLines = orderedOutcomes
  .map(
    (o) =>
      `- ${o.id}【${o.status}】${o.summary}；变更：${o.changedFiles.join("、") || "无"}${o.issues.length > 0 ? "；问题：" + o.issues.join(" / ") : ""}`,
  )
  .join("\n");

const audit = await lead.ask<Audit>(
  `swarm 执行完毕，请做整体终审。总目标：${goal}\n\n` +
    `各任务结局：\n${outcomeLines}\n\n` +
    (merge !== null ? `合并结果：已合并 ${merge.merged.join("、") || "无"}；跳过 ${merge.skipped.map((s) => `${s.id}(${s.reason})`).join("、") || "无"}。\n\n` : "") +
    (regression !== null
      ? `集成回归：${regression.pass ? "全部通过" : "未通过"}。命令结果：${JSON.stringify(regression.commands)}${repair !== null ? `；修复：${repair.summary}（改动 ${repair.changedFiles.join("、") || "无"}）` : ""}\n\n`
      : "集成回归：未配置全量测试命令，跳过。\n\n") +
    (digest !== "" ? `工人信箱消息摘录：\n${digest}\n\n` : "") +
    `当前工作区状态：${stText}。\n\n` +
    `请做整体终审：${useWorktree ? "检查合并后的整体是否自洽——两个任务的改动是否互相冲突、是否漏了双方都依赖的公共文件" : "检查各任务是否越界改了别人范围的文件、改动之间是否互相冲突"}；抽查几个关键文件核对质量；把真实问题和风险列进 findings；自己没查或查不清的部分写进 notCovered。`,
);

// ---------- 汇总 ----------

const doneCount = orderedOutcomes.filter((o) => o.status === "已完成").length;
const failCount = orderedOutcomes.filter((o) => o.status === "未过验证").length;
const blockedCount = orderedOutcomes.filter((o) => o.status === "受阻").length;

const verified: string[] = [
  `git rev-parse 探测：${insideRepo ? "是 git 仓库" : "不是 git 仓库"}，隔离方式 = ${useWorktree ? "git worktree" : "共享工作区+范围分区"}`,
];
for (const o of orderedOutcomes) {
  if (o.status === "已完成") {
    verified.push(`${o.id}：验证员第 ${o.rounds} 轮实测通过${o.evidence !== "" ? " — " + o.evidence.slice(0, 200) : ""}`);
  }
}
if (merge !== null) {
  for (const m of merge.merged) verified.push(`${m}：git merge --no-ff 合并成功`);
}
if (regression !== null) {
  for (const c of regression.commands) {
    verified.push(`回归命令 ${c.cmd}：exitCode=${c.exitCode}${c.note !== "" ? " — " + c.note.slice(0, 150) : ""}`);
  }
}
if (stClean !== null) {
  verified.push("结束后用 git status 核对过工作区状态（过滤了 .swarm/ 与预期产出）");
}

const notCovered: string[] = [];
if (dirtyAtStart && useWorktree) notCovered.push("开工时工作区已有未提交改动：worktree 基于 HEAD，工人看不到这些改动，合并结果不包含它们。");
if (!useWorktree) notCovered.push("共享工作区模式没有提交/合并门禁：所有改动以工作区未提交状态交付，请自行 git diff 审阅后再提交。");
for (const id of worktreeFallbacks) {
  notCovered.push(`${id}：worktree 创建失败（清理残留后仍失败），回退共享模式执行，改动直接留在主工作区。`);
}
if (gateCommands.length === 0) notCovered.push("领队未发现可信的全量构建/测试命令，集成回归门禁跳过，跨任务集成只靠领队抽查。");
orderedOutcomes.forEach((o) => {
  if (o.status === "未过验证") {
    notCovered.push(
      `${o.id}：修复 ${o.rounds} 轮后仍未通过对抗验证，其改动${o.worktree !== undefined ? "未合并，现场保留在 " + o.worktree : "已留在主工作区"}，需要人工处理。`,
    );
  }
});
for (const nc of audit.notCovered) notCovered.push(nc);

const findings: Finding[] = [];
for (const o of orderedOutcomes) {
  if (o.status === "未过验证") {
    for (const issue of o.issues) findings.push({ where: o.id, what: `任务未通过对抗验证：${issue}`, evidence: o.evidence, status: "verified", severity: "medium" });
  }
  if (o.status === "受阻") findings.push({ where: o.id, what: `任务受阻：${o.summary}`, evidence: o.evidence, status: "unconfirmed", severity: "medium" });
}
for (const id of worktreeFallbacks) {
  findings.push({ where: id, what: "worktree 创建失败，该任务回退共享模式执行", evidence: "git worktree add 退出码非 0", status: "verified", severity: "low" });
}
if (merge !== null) {
  for (const sk of merge.skipped) findings.push({ where: sk.id, what: `分支未合并：${sk.reason}`, evidence: "合并员汇报", status: "verified", severity: "medium" });
}
if (regression !== null && !regression.pass) {
  findings.push({ where: "（集成回归）", what: `修复${repair !== null ? "一轮" : ""}后回归仍未通过：${regression.issues.join("；")}`, evidence: JSON.stringify(regression.commands).slice(0, 400), status: "verified", severity: "high" });
} else if (regression !== null && repair !== null) {
  findings.push({ where: "（集成回归）", what: `回归曾失败，修复一轮后通过：${repair.summary}`, evidence: "重跑命令全部退出码 0", status: "verified", severity: "low" });
}
if (unexpectedUnstaged.length + unexpectedUntracked.length > 0) {
  findings.push({
    where: "（主工作区）",
    what: `结束时工作区有非预期改动：未暂存 ${unexpectedUnstaged.length} 个、未跟踪 ${unexpectedUntracked.length} 个文件${unexpectedUnstaged.concat(unexpectedUntracked).length > 0 ? "，如：" + unexpectedUnstaged.concat(unexpectedUntracked).slice(0, 10).join("、") : ""}`,
    evidence: "git status（已过滤 .swarm/ 与各任务声明的产出）",
    status: "verified",
    severity: "medium",
  });
}
for (const f of audit.findings) findings.push({ where: f.where, what: f.what, evidence: "领队终审（未经第二双眼睛确认）", status: "unconfirmed", severity: f.severity });

const lines: string[] = [];
lines.push("# Swarm 执行报告", "", `**目标**：${goal}`, "");
lines.push(`- 隔离方式：${useWorktree ? "git worktree（每任务独立工作树，通过后合并落主分支）" : "共享工作区+范围分区"}（并行工人 ${workerCount}）`);
lines.push(`- 结果：**已完成 ${doneCount}** / 未过验证 ${failCount} / 受阻 ${blockedCount}（共 ${enqueuedTotal} 个任务，含后续任务 ${enqueuedTotal - tasks.length} 个）`, "");
lines.push(`> ${plan.approach}`, "");
for (const o of orderedOutcomes) {
  lines.push(`## ${o.id} · ${o.title} —【${o.status}】`, "");
  lines.push(`- 摘要：${o.summary}`);
  lines.push(`- 变更文件：${o.changedFiles.length > 0 ? o.changedFiles.join("、") : "无"}`);
  lines.push(`- 验证轮次：${o.rounds}`);
  if (o.issues.length > 0) lines.push(`- 问题：`, ...o.issues.map((x) => `  - ${x}`));
  if (o.evidence !== "") lines.push(`- 验证证据：${o.evidence}`);
  lines.push("");
}
if (merge !== null) {
  lines.push(`## 合并与清理`, "", `- 已合并：${merge.merged.join("、") || "无"}`, `- 跳过：${merge.skipped.map((s) => `${s.id}（${s.reason}）`).join("；") || "无"}`, `- 清理：${merge.cleanup}`, "");
}
if (regression !== null) {
  lines.push(`## 集成回归`, "", ...(repair !== null ? [`- 修复：${repair.summary}（改动：${repair.changedFiles.join("、") || "无"}）`] : []), "");
  for (const c of regression.commands) lines.push(`- \`${c.cmd}\` → exitCode=${c.exitCode}：${c.note}`);
  lines.push("");
}
if (digest !== "") {
  lines.push(`## 信箱消息`, "", digest, "");
}
lines.push(`## 领队终审`, "", audit.summary, "");
if (audit.notCovered.length > 0) lines.push(`**未覆盖**：`, ...audit.notCovered.map((x) => `- ${x}`), "");
await artifact.markdown("report", lines.join("\n"), {
  title: "Swarm 执行报告",
  description: `目标「${goal.length > 40 ? goal.slice(0, 40) + "…" : goal}」的多智能体执行结果与终审`,
  primary: true,
});

const result: WorkflowReport = {
  conclusion: `共执行 ${enqueuedTotal} 个任务（含工人上报的后续任务 ${enqueuedTotal - tasks.length} 个）：${doneCount} 个通过对抗验证，${failCount} 个未过验证，${blockedCount} 个受阻。${audit.summary}`,
  findings: findings,
  verified: verified,
  notCovered: notCovered,
  tasks: orderedOutcomes,
};
return result;
