# Super-agent 五个观察点：dsh 与现有方案

2026-11-03。主文：[PR 合并以后，谁接下一条反馈？](../superagent.html)。按 Router、daemon、Watchdog、Session 数据库、异步 ReAct Loop 五点，比较 dsh 原文设计、公开原型 `6337fc8` 与市面已有方案。只引用官方文档、源码和官方博客，当天抓取；源码写到文件路径。未找到一手来源的标“未核实”。各来源均未给出可比的性能数据，本文不做效果判断。

部分来源已迁移：Cursor 文档在 `cursor.com/docs`；`developers.openai.com/codex` 跳转到 `learn.chatgpt.com/docs`；OpenHands 主仓 `main` 已移除旧 runtime，旧代码引用 tag `1.6.0`，新实现在 `OpenHands/software-agent-sdk`；Letta 主仓转到 `letta-code`。

## 01 Router

dsh 原文用 Router/Worker 双层：程序先按来源、名单和 @ 准入，Router 模型再判断 `accept / attach / stop / ignore`；公开原型已实现，已订阅讨论的消息由 `Intake.receive()` 查 `Thread.subscriptions` 直通 Worker（[`src/core/intake.ts`][dsh-intake]、[`prompts/dispatch.md`][dsh-dispatch]、[`src/policy.ts`][dsh-policy]）。

| 方案 | 做法 | 来源 |
| --- | --- | --- |
| Devin（Slack） | `@Devin` 发起会话，之后在同一 thread 来回对话；`mute` 停止读取该 thread，`!aside` 让它忽略单条消息 | [Slack 集成][devin-slack] |
| Cursor（Slack、GitHub） | thread 里已有 agent 时，再 `@Cursor` 视为追加指令，`@Cursor agent` 强制新建；仓库和环境从消息、`repo=`/`env=` 参数和近期活动推断。PR、Issue 评论 `@cursor` 启动 agent | [Slack][cursor-slack]、[Cloud Agent][cursor-cloud] |
| Codex / ChatGPT | Slack 入口为 `@ChatGPT`，同一 thread、同一账号的后续请求延续原 coding task 与环境，换账号可能另起任务；PR 中 `@codex review` 触发审查，其他 `@codex` 以该 PR 为上下文启动云任务 | [Slack][codex-slack]、[GitHub][codex-github] |
| GitHub Copilot cloud agent | 把 Issue 指派给 Copilot 后自动开 PR；PR 评论 `@copilot` 继续迭代，并保留同一 PR 上之前会话的上下文 | [修改已有 PR][copilot-pr] |
| OpenAI Agents SDK / LangGraph supervisor | 进程内多 agent 路由：handoff 以 `transfer_to_<agent_name>` 工具交给模型，新 agent 默认看到完整历史，可用 `input_filter` 裁剪；supervisor 由中央 agent 用工具式 handoff 决定调用谁 | [handoffs][oai-handoffs]、[langgraph-supervisor][lg-supervisor] |

现有产品都按“同一 thread / 同一 PR 延续同一任务”的规则归属消息，Cursor 还提供强制新建的显式语法；未见公开文档描述跨 thread、跨渠道的多对多订阅或语义归属判断，dsh 在这一点上更细。

## 02 daemon

dsh 原文设计云端无状态 Loop 通过轻量 daemon 在开发机或远端环境执行工具；公开原型没有 daemon，只用本机 SQLite、目录锁和本地子进程（[`docs/007-architecture.md`][dsh-arch]、[`docs/003-execution.md`][dsh-exec]）。

| 方案 | Loop 在哪 | 工具在哪执行 | 用户机器能否作执行端 | 来源 |
| --- | --- | --- | --- | --- |
| Cursor Cloud Agents / Self-Hosted | Cursor 云端，负责循环、推理与规划 | 托管 Ubuntu VM（`.cursor/environment.json` 指定 Dockerfile），或自托管 worker | 能。`agent worker start` 向 Cursor 建立长连接出站 HTTPS，Cursor 经此下发工具调用，无需入站端口；My Machines 模式下终端命令、文件编辑在本机执行 | [setup][cursor-setup]、[self-hosted][cursor-self]、[my-machines][cursor-mine] |
| OpenHands runtime | 后端 AgentController 与 EventStream | 沙箱内 `action_execution_server`（FastAPI，`POST /execute_action`），后端经 REST 发 action、收 observation；另有 RemoteRuntime 与 LocalRuntime | 能。LocalRuntime 直接在本机运行 action execution server | [runtime 架构][oh-runtime]、`openhands/runtime/action_execution_server.py`、`impl/remote/remote_runtime.py`、`impl/local/local_runtime.py`（[tag 1.6.0][oh-160]） |
| Claude Code | 云会话在 Anthropic 托管环境；self-hosted 模式下整个 Claude Code 进程在用户主机 | 同 Loop 所在处；claude-code-action 在用户的 GitHub runner | 能。runner 从队列认领会话，在主机上启动 Claude Code 进程，连接全部出站；推理仍走模型 API | [web][cc-web]、[self-hosted][cc-self]、[claude-code-action][cc-action] |
| GitHub Copilot cloud agent | GitHub | 云沙箱、GitHub Actions（`copilot-setup-steps.yml`）或 custom environment | 能。可用 self-hosted runner，或把 Linux 机器、codespace 注册为 custom environment；该模式下循环与工具如何拆分未核实 | [about][copilot-about]、[环境定制][copilot-env] |
| Codex cloud / E2B | Codex：云端容器内循环执行终端命令；E2B：只提供沙箱 | Codex：每任务独立容器，setup 阶段可联网，agent 阶段默认断网，secrets 在 agent 阶段前移除；E2B：每会话一台 Firecracker microVM，可 pause/resume | Codex cloud 是否支持本机作执行端未核实；Codex CLI 直接在本机执行 | [Codex 环境][codex-env]、[联网][codex-net]、[E2B infra][e2b-infra]、[E2B sandbox][e2b-sandbox] |

Cursor self-hosted worker 与 OpenHands action execution server 已是 dsh 图中“Loop 在云、工具在端”的落地形态，含出站长连接、环境镜像和本机执行三种部署；dsh 公开原型这部分仍是空白。

## 03 Watchdog

dsh 原文设计独立 Session 定时巡检存活、卡死、无效循环和偏离目标；公开原型只有部署文档中另一个 profile 的每小时巡检提示词，调用 `status` 后按退出码保持安静、报告或 `--respect-stop restart`，没有循环或跑偏检测的实现与数据（[`docs/006-deployment.md`][dsh-deploy] “Hourly check”）。

| 方案 | 检查什么 | 触发后 | 来源 |
| --- | --- | --- | --- |
| OpenHands StuckDetector | 五种模式：同 action 同 observation（默认 4 次）、同 action 连续报错（3）、独白（3）、最近 6 步交替模式、上下文窗口错误循环；另有 `max_iteration_per_run`（默认 500）、`max_budget_per_task` | V0 抛 `AgentStuckInLoopError`；V1 对重复报错先注入一次提示消息，仍卡住则把状态设为 `STUCK` 并停止 | `openhands-sdk/openhands/sdk/conversation/stuck_detector.py`、`conversation/impl/local_conversation.py`（[software-agent-sdk][oh-sdk]）；`openhands/controller/stuck.py`（[tag 1.6.0][oh-160]） |
| SWE-agent | 单实例与总成本、API 调用次数；单命令 30 s、总执行 1800 s 超时，连续 3 次超时 | 抛超限异常；超成本时自动提交后退出；总超时不中断正在运行的命令，下一步前停止 | `sweagent/agent/models.py`、`sweagent/tools/tools.py`、`sweagent/agent/agents.py`（[SWE-agent][swe]） |
| Temporal | Activity 心跳表示仍在进展；Start-To-Close 限制单次尝试，主要用于发现启动后崩溃的 Worker；Schedule-To-Close 限制含重试的总时长（默认无限） | 超时即该尝试失败，按 Retry Policy 重试 | [检测 Activity 失败][temporal-timeouts] |
| Kubernetes probes | liveness 发现“运行中但无法进展”（如死锁）；readiness 判断能否接流量；startup 成功前不跑另外两种 | liveness 失败重启容器；readiness 失败摘除流量 | [probes][k8s-probes] |
| 框架级上限与校验 | LangGraph `recursion_limit`（v1.1.4 起默认 10,007）；Agents SDK `max_turns`；Agents SDK guardrails 的 tripwire；Claude Code `Stop` hook 可 `block` 阻止结束，`PreToolUse` 可拒绝工具调用，hook 可以是 agent 型检查 | 分别抛 `GraphRecursionError`、`MaxTurnsExceeded`、`*GuardrailTripwireTriggered`；Stop hook 连续续跑 8 次后强制结束 | [LangGraph][lg-graph]、[running agents][oai-run]、[guardrails][oai-guard]、[hooks][cc-hooks] |

现有方案提供了 dsh 缺少的机械化“无效循环”判据（OpenHands 的五种重复模式与阈值）和进展心跳（Temporal heartbeat、K8s liveness）；“偏离目标”的语义判断，公开资料只找到 guardrails 和 agent 型 hook 这类由用户自写的检查，没有找到现成的检测实现。

## 04 Session 数据库

### 任务状态存在哪里

dsh 公开原型把 Trigger、Thread、Ticket、Assignment、Decision、订阅和设置写进 `<stateDir>/orchestrator.sqlite`，启动时先锁状态目录；对外动作在同一事务里写入持久 Effects 队列，提交后执行，失败按退避重试（[`docs/007-architecture.md`][dsh-arch] Store、Effects；[`docs/006-deployment.md`][dsh-deploy] `stateDir`）。

| 方案 | 任务身份与状态 | 崩溃恢复 | 外部副作用 | 来源 |
| --- | --- | --- | --- | --- |
| Temporal | Workflow ID 为业务标识，同一 Namespace 内同时只能有一个 Open 执行使用；Event History 是持久日志 | Worker 崩溃后重放 Event History 恢复状态，从失败点继续 | 已完成的 Activity 重放时不重跑；返回前未记录的会重试，文档要求做成幂等 | [Event History][temporal-history]、[Workflow ID][temporal-id]、[Activity][temporal-activity] |
| DBOS | 工作流与步骤 checkpoint 到 Postgres；Workflow ID 即幂等键，同 ID 只执行一次 | 从最后一个已完成步骤恢复 | 步骤至少执行一次、完成后不再执行；数据库事务恰好提交一次 | [architecture][dbos-arch]、[workflow 教程][dbos-wf] |
| Restate / Inngest | Restate 把每步操作和结果记入 journal；Inngest 保存 `step.run()` 结果 | 重放时跳过已完成步骤，直接返回已存结果 | Restate 支持请求头 idempotency key 去重；Inngest 文档提醒步骤可能在结果保存前已生效，需幂等 | [Restate][restate]、[Inngest][inngest] |
| LangGraph checkpointer | 每个 super-step 存状态快照，以 `thread_id` 为主键；`SqliteSaver`、`PostgresSaver` | 同 super-step 已成功的节点不重跑；`sync` 模式在下一步前同步落盘，`exit` 模式无法从中途崩溃恢复 | 已完成 `@task` 结果从 checkpoint 读取；未完成的可能重跑，文档要求副作用幂等 | [checkpointers][lg-ckpt]、[functional API][lg-func] |

### 会话历史存在哪里

dsh 公开原型不自己保存模型对话，交给 DeepSeek Harness：`dsh-session` 把模型可见的每条事实追加到事件日志，压缩只把旧条目从当前视图隐藏、不删除；`dsh-base` bundle 挂载 JSONL 后端，`root: dshHomePath('sessions')`，每个会话一份 `session.v3.jsonl.zstd`（默认 Zstandard，可设 `compression: 'none'` 存明文），带 `flock` 单写者锁。恢复时 agent-loop 读日志，为中断的回合补写错误 `tool/result` 与 `turn/end {interrupted}`。原型读取 Worker transcript 用 `sessionController.inspect(worker-<ticketId>)`（[`src/app/resources.ts`][dsh-resources]），自己只在 SQLite kv 存 `session-prompts:<session id>`。依据为 Harness 公开仓库与原型依赖的 npm `0.2.1-alpha.2` 包 README（[session][dsh-session]、[persistence][dsh-persist]、[jsonl][dsh-jsonl]、[base patch][dsh-base]）。`dshHomePath('sessions')` 实际解析为 `~/.dsh/sessions` 是按部署文档“`DSH_HOME` 默认 `~/.dsh`”推断，未核实函数定义。

| 方案 | 位置 | 格式与内容 | 恢复与压缩 | 来源 |
| --- | --- | --- | --- | --- |
| Claude Code / Agent SDK | 本地 `~/.claude/projects/<project>/<session>.jsonl`，子代理在 `<session>/subagents/`；默认明文保留 30 天（`cleanupPeriodDays`） | JSONL：消息、工具调用与结果，以及请求的 system prompt、工具定义 | `--continue`、`--resume`、`--fork-session`；SDK 可用 `SessionStore` 适配器镜像到共享存储跨机器恢复；自动 compaction 生成摘要，摘要在 JSONL 中的表示未核实 | [`.claude` 目录][cc-dir]、[数据使用][cc-data]、[SDK sessions][cc-sessions]、[工作方式][cc-how] |
| OpenAI Codex CLI | 本地 `~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<id>.jsonl` | 每行 `RolloutLine { timestamp, ordinal, item }`，`item` 含 `SessionMeta`、`ResponseItem`、`TurnContext`、`Compacted`（带 `replacement_history`） | `codex resume [--last]`；重建时以最近的 `Compacted` 为检查点，再接其后的条目 | `codex-rs/rollout/src/recorder.rs`、`codex-rs/history/src/lib.rs`、`codex-rs/core/src/session/rollout_reconstruction.rs`（[openai/codex][codex-repo]）、[CLI 参考][codex-cli] |
| OpenAI Agents SDK Sessions | `SQLiteSession` 默认内存，可指定文件；另有 Redis、SQLAlchemy、MongoDB、加密封装、`OpenAIConversationsSession`（服务端） | 运行前取历史拼到输入前，运行后写回用户输入、回复、工具调用等条目 | `OpenAIResponsesCompactionSession` 包装其他 session 做自动压缩 | [sessions][oai-sessions] |
| OpenAI Responses / Conversations | OpenAI 服务端 | Response 默认存 30 天（`store=false` 关闭），用 `previous_response_id` 串联；Conversation 是持久对象，存消息、工具调用与输出，不受 30 天限制 | 按 ID 续接 | [conversation state][oai-conv] |
| OpenHands SDK | `FileStore` 下 `base_state.json` 与 `events/event-{idx:05d}-{event_id}.json`，每事件一个 JSON 文件 | 事件按索引或 ID 读取，写入加锁 | `ConversationState.create()` 新建或从持久化恢复；`LLMSummarizingCondenser` 摘要被遗忘的事件 | `openhands-sdk/openhands/sdk/conversation/persistence_const.py`、`event_store.py`、`state.py`、`context/condenser/llm_summarizing_condenser.py`（[software-agent-sdk][oh-sdk]）、[持久化指南][oh-persist] |
| LangGraph / Letta | LangGraph：消息即线程状态，随 checkpointer 存 SQLite/Postgres；Letta：本地默认 `~/.letta/lc-local-backend` | Letta 当前格式未核实；已退役 V1 服务端用 Postgres 或 SQLite | LangGraph 同 `thread_id` 续接；Letta 压缩旧消息但保留完整历史供 conversation search | [checkpointers][lg-ckpt]、[Letta 自托管][letta-self]、[conversations][letta-conv]、`letta/settings.py`（[archive 分支][letta-archive]） |

任务状态部分，Temporal、DBOS、Restate 把“步骤结果入日志、重放跳过已完成步骤”做成通用运行时，并提供 Workflow ID 唯一性和 idempotency key，dsh 的 Effects 队列只覆盖本地事务提交后的重试。会话历史部分，dsh 借 Harness 已有追加式事件日志、压缩不删原文和中断回合补全，与 Claude Code、Codex 的 JSONL 方案同类；现有方案多出的是跨机器恢复（Claude `SessionStore`、OpenAI Conversations 服务端存储）和 fork。

## 05 异步 ReAct Loop

dsh 原文让工具先返回 Started、后台运行，结果作为事件回到会话；公开原型借 Harness 实现，worker/router preset 把超过 5 秒的前台命令转后台，Router 的 `job_output` 等待最多 5 秒，新消息经 `agent.steer()` 在下一步读入（[`cordis.patch.yml`][dsh-patch]、[`src/app/sessions.ts`][dsh-sessions]、[`docs/003-execution.md`][dsh-exec]）。

| 方案 | 后台执行 | 运行中接收新输入 | 来源 |
| --- | --- | --- | --- |
| Claude Code | Bash `run_in_background: true` 立即返回任务 ID；`Ctrl+B` 把运行中命令转后台；命令超时转后台而非终止；`Monitor` 把输出行作为事件回传，`TaskStop` 停止 | 工作中输入的消息排队，当前工具调用结束后在同一回合注入；`Esc` 中断 | [interactive mode][cc-interactive]、[tools reference][cc-tools] |
| OpenAI Codex | unified exec：`exec_command` 默认 10 s 后让出并返回 `session_id`，`write_stdin` 轮询或写入；`/ps`、`/stop` 管理后台终端 | app-server `turn/steer` 把输入追加到进行中的回合，`turn/interrupt` 中断；TUI 区分“下一个工具调用后提交”的 steer 与排队的 follow-up；review、compact 回合不可 steer | [app-server][codex-app]、`codex-rs/core/src/tools/handlers/unified_exec.rs`、`codex-rs/app-server-protocol/schema/typescript/v2/NonSteerableTurnKind.ts`（[openai/codex][codex-repo]） |
| OpenAI Responses API | `background: true` 异步运行，状态为 `queued`/`in_progress` 时轮询，`cancel` 幂等 | `response.steer` 在回合中途追加指令，不撤回已发输出、不取消已启动的工具；仅 GPT-6 系列经 WebSocket 连接支持 | [background][oai-bg]、[steering][oai-steer] |
| LangGraph / LangSmith | `interrupt()` 暂停节点，状态经 checkpointer 保存，`Command(resume=...)` 恢复 | double-texting 四种策略：enqueue（默认）、reject、interrupt、rollback；仅 LangSmith Deployment 提供，开源框架没有 | [interrupts][lg-interrupt]、[double-texting][ls-double] |

现有方案把“运行中来新消息怎么办”做成显式策略：Codex 区分 steer 与排队，LangSmith 提供 enqueue / reject / interrupt / rollback 四选一，Claude Code 允许中途把前台命令转后台；dsh 公开原型只有 steer 加 5 秒转后台这一种处理。

## 未核实

- dsh：`dshHomePath('sessions')` 的实际路径；原文中云端 Loop 与 daemon 的协议。
- Codex cloud 能否以用户机器作执行端；Codex TUI 发送 steer 的按键。
- Copilot custom environment 下循环与工具执行的拆分。
- Claude Code compaction 摘要在 JSONL 中的表示。
- Letta 当前版本的消息存储格式；memory blocks / archival memory 在当前文档中的对应。
- OpenHands V0 的 `sessions/<sid>/events/*.json` 路径。
- Temporal 文档未出现 “at-least-once” 原词，表中只写“会重试、需幂等”。

## 来源

dsh 公开原型（固定 `6337fc8`）与 DeepSeek Harness（公开仓库 `ce7073d`，原型依赖的 npm 版本 `0.2.1-alpha.2`）：

- `dsh-intake`：<https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/core/intake.ts>
- `dsh-dispatch`：<https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/prompts/dispatch.md>
- `dsh-policy`：<https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/policy.ts>
- `dsh-arch`：<https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/007-architecture.md>
- `dsh-exec`：<https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/003-execution.md>
- `dsh-deploy`：<https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/006-deployment.md>
- `dsh-resources`：<https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/resources.ts>
- `dsh-sessions`：<https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/sessions.ts>
- `dsh-patch`：<https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/cordis.patch.yml>
- `dsh-session`：<https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/core/session/README.md>
- `dsh-persist`：<https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/session/session-persistence/README.md>
- `dsh-jsonl`：<https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/session/session-persistence-jsonl/README.md>
- `dsh-base`：<https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/base/cordis.patch.yml>

其他方案：

- `devin-slack`：<https://docs.devin.ai/integrations/slack>
- `cursor-slack`：<https://cursor.com/docs/integrations/slack>
- `cursor-cloud`：<https://cursor.com/docs/cloud-agent>
- `cursor-setup`：<https://cursor.com/docs/cloud-agent/setup>
- `cursor-self`：<https://cursor.com/docs/cloud-agent/self-hosted>
- `cursor-mine`：<https://cursor.com/docs/cloud-agent/self-hosted/my-machines>
- `codex-slack`：<https://learn.chatgpt.com/docs/third-party/slack>
- `codex-github`：<https://learn.chatgpt.com/docs/third-party/github>
- `codex-env`：<https://learn.chatgpt.com/docs/environments/cloud-environment>
- `codex-net`：<https://learn.chatgpt.com/docs/cloud/internet-access>
- `codex-cli`：<https://developers.openai.com/codex/cli/reference>
- `codex-app`：<https://developers.openai.com/codex/app-server>
- `codex-repo`：<https://github.com/openai/codex>
- `copilot-pr`：<https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/make-changes-to-an-existing-pr>
- `copilot-about`：<https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent>
- `copilot-env`：<https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment>
- `oai-handoffs`：<https://github.com/openai/openai-agents-python/blob/main/docs/handoffs.md>
- `oai-run`：<https://openai.github.io/openai-agents-python/running_agents/>
- `oai-guard`：<https://openai.github.io/openai-agents-python/guardrails/>
- `oai-sessions`：<https://openai.github.io/openai-agents-python/sessions/>
- `oai-conv`：<https://platform.openai.com/docs/guides/conversation-state>
- `oai-bg`：<https://developers.openai.com/api/docs/guides/background>
- `oai-steer`：<https://developers.openai.com/api/docs/guides/steering>
- `lg-supervisor`：<https://github.com/langchain-ai/langgraph-supervisor-py/blob/main/README.md>
- `lg-graph`：<https://docs.langchain.com/oss/python/langgraph/graph-api>
- `lg-ckpt`：<https://docs.langchain.com/oss/python/langgraph/checkpointers>
- `lg-func`：<https://docs.langchain.com/oss/python/langgraph/functional-api>
- `lg-interrupt`：<https://docs.langchain.com/oss/python/langgraph/interrupts>
- `ls-double`：<https://docs.langchain.com/langsmith/double-texting>
- `oh-runtime`：<https://docs.openhands.dev/usage/architecture/runtime>
- `oh-160`：<https://github.com/OpenHands/OpenHands/tree/1.6.0>
- `oh-sdk`：<https://github.com/OpenHands/software-agent-sdk>
- `oh-persist`：<https://docs.openhands.dev/sdk/guides/convo-persistence>
- `cc-web`：<https://code.claude.com/docs/en/claude-code-on-the-web>
- `cc-self`：<https://code.claude.com/docs/en/self-hosted-environments>
- `cc-action`：<https://github.com/anthropics/claude-code-action/blob/main/README.md>
- `cc-hooks`：<https://code.claude.com/docs/en/hooks>
- `cc-interactive`：<https://code.claude.com/docs/en/interactive-mode>
- `cc-tools`：<https://code.claude.com/docs/en/tools-reference>
- `cc-dir`：<https://code.claude.com/docs/en/claude-directory>
- `cc-data`：<https://code.claude.com/docs/en/data-usage>
- `cc-sessions`：<https://code.claude.com/docs/en/agent-sdk/sessions>
- `cc-how`：<https://code.claude.com/docs/en/how-claude-code-works>
- `e2b-infra`：<https://github.com/e2b-dev/infra/blob/main/README.md>
- `e2b-sandbox`：<https://e2b.dev/docs/sandbox>
- `swe`：<https://github.com/SWE-agent/SWE-agent>
- `temporal-timeouts`：<https://docs.temporal.io/encyclopedia/detecting-activity-failures>
- `temporal-history`：<https://docs.temporal.io/encyclopedia/event-history>
- `temporal-id`：<https://docs.temporal.io/workflow-execution/workflowid-runid>
- `temporal-activity`：<https://docs.temporal.io/activity-definition>
- `k8s-probes`：<https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/>
- `dbos-arch`：<https://docs.dbos.dev/architecture>
- `dbos-wf`：<https://docs.dbos.dev/python/tutorials/workflow-tutorial>
- `restate`：<https://docs.restate.dev/concepts/durable_execution>
- `inngest`：<https://www.inngest.com/docs/learn/how-functions-are-executed>
- `letta-self`：<https://docs.letta.com/self-hosting/>
- `letta-conv`：<https://docs.letta.com/concepts/conversations/>
- `letta-archive`：<https://github.com/letta-ai/letta/tree/archive>

[dsh-intake]: https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/core/intake.ts
[dsh-dispatch]: https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/prompts/dispatch.md
[dsh-policy]: https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/policy.ts
[dsh-arch]: https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/007-architecture.md
[dsh-exec]: https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/003-execution.md
[dsh-deploy]: https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/docs/006-deployment.md
[dsh-resources]: https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/resources.ts
[dsh-sessions]: https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/src/app/sessions.ts
[dsh-patch]: https://github.com/deepseek-ai/dsh-superagent-prototype/blob/6337fc823ce20251c8de8085948165c81aaa701e/cordis.patch.yml
[dsh-session]: https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/core/session/README.md
[dsh-persist]: https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/session/session-persistence/README.md
[dsh-jsonl]: https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/session/session-persistence-jsonl/README.md
[dsh-base]: https://github.com/deepseek-ai/deepseek-harness/blob/ce7073d51254c26cd63b22a60835b8f948deb447/packages/bundle/base/cordis.patch.yml
[devin-slack]: https://docs.devin.ai/integrations/slack
[cursor-slack]: https://cursor.com/docs/integrations/slack
[cursor-cloud]: https://cursor.com/docs/cloud-agent
[cursor-setup]: https://cursor.com/docs/cloud-agent/setup
[cursor-self]: https://cursor.com/docs/cloud-agent/self-hosted
[cursor-mine]: https://cursor.com/docs/cloud-agent/self-hosted/my-machines
[codex-slack]: https://learn.chatgpt.com/docs/third-party/slack
[codex-github]: https://learn.chatgpt.com/docs/third-party/github
[codex-env]: https://learn.chatgpt.com/docs/environments/cloud-environment
[codex-net]: https://learn.chatgpt.com/docs/cloud/internet-access
[codex-cli]: https://developers.openai.com/codex/cli/reference
[codex-app]: https://developers.openai.com/codex/app-server
[codex-repo]: https://github.com/openai/codex
[copilot-pr]: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/make-changes-to-an-existing-pr
[copilot-about]: https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent
[copilot-env]: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment
[oai-handoffs]: https://github.com/openai/openai-agents-python/blob/main/docs/handoffs.md
[oai-run]: https://openai.github.io/openai-agents-python/running_agents/
[oai-guard]: https://openai.github.io/openai-agents-python/guardrails/
[oai-sessions]: https://openai.github.io/openai-agents-python/sessions/
[oai-conv]: https://platform.openai.com/docs/guides/conversation-state
[oai-bg]: https://developers.openai.com/api/docs/guides/background
[oai-steer]: https://developers.openai.com/api/docs/guides/steering
[lg-supervisor]: https://github.com/langchain-ai/langgraph-supervisor-py/blob/main/README.md
[lg-graph]: https://docs.langchain.com/oss/python/langgraph/graph-api
[lg-ckpt]: https://docs.langchain.com/oss/python/langgraph/checkpointers
[lg-func]: https://docs.langchain.com/oss/python/langgraph/functional-api
[lg-interrupt]: https://docs.langchain.com/oss/python/langgraph/interrupts
[ls-double]: https://docs.langchain.com/langsmith/double-texting
[oh-runtime]: https://docs.openhands.dev/usage/architecture/runtime
[oh-160]: https://github.com/OpenHands/OpenHands/tree/1.6.0
[oh-sdk]: https://github.com/OpenHands/software-agent-sdk
[oh-persist]: https://docs.openhands.dev/sdk/guides/convo-persistence
[cc-web]: https://code.claude.com/docs/en/claude-code-on-the-web
[cc-self]: https://code.claude.com/docs/en/self-hosted-environments
[cc-action]: https://github.com/anthropics/claude-code-action/blob/main/README.md
[cc-hooks]: https://code.claude.com/docs/en/hooks
[cc-interactive]: https://code.claude.com/docs/en/interactive-mode
[cc-tools]: https://code.claude.com/docs/en/tools-reference
[cc-dir]: https://code.claude.com/docs/en/claude-directory
[cc-data]: https://code.claude.com/docs/en/data-usage
[cc-sessions]: https://code.claude.com/docs/en/agent-sdk/sessions
[cc-how]: https://code.claude.com/docs/en/how-claude-code-works
[e2b-infra]: https://github.com/e2b-dev/infra/blob/main/README.md
[e2b-sandbox]: https://e2b.dev/docs/sandbox
[swe]: https://github.com/SWE-agent/SWE-agent
[temporal-timeouts]: https://docs.temporal.io/encyclopedia/detecting-activity-failures
[temporal-history]: https://docs.temporal.io/encyclopedia/event-history
[temporal-id]: https://docs.temporal.io/workflow-execution/workflowid-runid
[temporal-activity]: https://docs.temporal.io/activity-definition
[k8s-probes]: https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/
[dbos-arch]: https://docs.dbos.dev/architecture
[dbos-wf]: https://docs.dbos.dev/python/tutorials/workflow-tutorial
[restate]: https://docs.restate.dev/concepts/durable_execution
[inngest]: https://www.inngest.com/docs/learn/how-functions-are-executed
[letta-self]: https://docs.letta.com/self-hosting/
[letta-conv]: https://docs.letta.com/concepts/conversations/
[letta-archive]: https://github.com/letta-ai/letta/tree/archive
