# AlgoCoach Agent 后端详细计划

> Python 3.12 + FastAPI + AgentScope 2.0.11 + ReMe · 端口 8000 · 以 AgentScope + ReMe 为基础的 OI/xCPC 刷题教练

> **实现状态（2026-11-13）**
> - **P0 已完成**，并已由负责人独立复核通过：`models/schemas.py` 抽取、`POST /memory/record` 契约与持久化。
> - **P1 已完成**：`agent/crons.py`、`notifications`、间隔复习、周报（文字 + 1920×1080/60fps 视频）、90 天归档；`memory/vector_store.py` 的题目/知识点/卡点向量记忆及 `fetch_problem_meta` / `get_similar_problems` tools。向量记忆已由负责人独立复核通过；`solution_comment` 仍为 V2。
> - **P2 Remotion 生成代码沙箱已实现，默认关闭、未上线**：新增 `remotion/codegen.py` 与 `POST /animate/generated`。只有 `REMOTION_CODEGEN_ENABLED=true`、配置 `REMOTION_CODEGEN_TOKEN`、Bearer token 校验通过且真实 Bubblewrap preflight 全部通过时才开放；活动 generated jobs 默认上限 1（clamp 1–2），满时 429。本机开发环境（Ubuntu、bubblewrap 0.11.1、systemd user scope、Chrome）已实测 preflight、离线隔离属性、沙箱内 ffprobe 和一次 1280×720/240 帧真实渲染；不可信 MP4 不在宿主解析。部署环境缺少 bwrap / 非特权 user namespace / systemd cgroup v2 delegation / Node / Chrome 时保持不可用，绝不回退到宿主执行。当前 Docker Compose 未授予这些能力，容器内该项不可用。
> - **P2 `agent/self_improve.py` 已实现（人工分析型 MVP）**：新增 `recommendation_log` 表及可重跑迁移、`memory.get_mastery`、推荐日志、固定 7 天回测、月度策略汇总、`suggest_next_problem` tool 与两个 cron job。回测按 `[created_at, evaluation_due_at]` 内的事件从 `mastery_before` 重放 ELO 并保存 `mastery_after`，延迟调度不会读入窗口外练习。评估只做记录与人工可读建议，**不自动修改 Soul、prompt、推荐权重或配置**，也没有正式 UI/通知。
> - **P3 prompt 集中管理与目标变体 API 已实现**：Soul 原文迁至 `agent/prompts.py`，`get_system_prompt(goal)` 支持 `interview_prep` / `contest` / `casual` 三种变体，未知值回退原版；`coach.chat()` 接收来自设置页的浏览器偏好目标；竞赛阶段显式覆盖该目标。目标保存在当前浏览器，不另建用户配置表。
> - **contest 训练协议已接入 `/chat`**：`ChatRequest` 新增可选 `trainingPhase`（默认 `auto`，允许 `virtual_contest` / `topic_drill` / `attempt` / `hint` / `review` / `upsolve`，未知回退 `auto`）与 `timeRemainingSec`（可选非负整数）；显式阶段或剩余时间会启用 `contest` 目标与真实 OI/xCPC 训练协议，阶段/剩余时间同时写入 AgentScope 用户消息，ReMe 记忆可见。`ChatResponse`、FOCUS 静默、非 contest 行为与旧客户端均不变，未新增训练 SQLite（详见 §3.3）。
> - **/chat Agent runtime 已迁移到 AgentScope 2.0.11 + 官方 ReMeMiddleware**：`AlgoCoach` 使用 `Agent`/`AgentState` 替代手写 Claude tool loop 与 `_sessions`；ReMe 进程内单实例，`mode="both"` 自动召回/写回，稳定 `session_id`，应用关闭时 `await coach.close()`。FOCUS 仍完全静默，`/chat` 请求/响应契约与工具 schema 不变。`requirements.txt` 已升级为可解依赖集（`agentscope[reme]==2.0.11` + `reme-ai==0.4.1.10`），通过独立 Python 3.12 venv 安装验证。

## 1. 模块职责与边界

Agent 后端只做三件事：**对话**、**记忆**、**动画生成**。它不直接调用 LeetCode API——那是 Java gateway 的职责。

| 职责 | 归属 | 说明 |
|------|------|------|
| LeetCode GraphQL（题目、提交） | Java gateway | Agent 通过 HTTP 调 gateway 获取题目元数据 |
| AgentScope 对话 + Tool Use | **Agent** | AgentScope `Agent` reasoning/acting loop |
| 四类记忆读写 | **Agent** | SQLite + 向量库；对话记忆由 ReMe 自动召回/写回 |
| Remotion 动画渲染 | **Agent** | 预置组件：subprocess 调用 `npx remotion`；生成代码：Bubblewrap 沙箱内渲染，默认关闭 |
| 代码执行/测试 | Java gateway | Agent 不执行用户代码 |

接口契约：前端通过 Java Gateway 的 `/api/agent/*` 调用 Python Agent；LeetCode 请求经 Gateway `/api/*` 代理。Agent 需要题目数据时反向调用 Gateway `/api/problems/{slug}`。

---

## 2. 目录结构

```
backend/agent/
├── app/
│   ├── main.py                    # FastAPI 入口，CORS，lifespan: init_db + 启停 crons
│   ├── agent/
│   │   ├── coach.py               # ★ AlgoCoach 核心：AgentScope Agent + ReMe 中间件 + TOOLS
│   │   ├── router.py              # /chat, /animate, /memory/profile/export 等 API 路由
│   │   ├── crons.py               # P1 已实现：APScheduler 定时任务 + notify_user；P2 加自改进回测/月报
│   │   ├── gateway.py             # P1 已实现：GET /api/problems/{slug} 客户端 + 响应归一化
│   │   ├── self_improve.py        # P2 已实现：推荐记录、7 天回测、月度汇总、suggest_next_problem
│   │   └── prompts.py             # P3 已实现：集中 Soul + 目标变体（get_system_prompt）
│   ├── memory/
│   │   ├── db.py                  # ★ SQLAlchemy 异步引擎 + 记忆/通知/复习/归档/推荐日志表 + 可重跑迁移
│   │   ├── memory_service.py      # ★ 四类记忆 CRUD + ELO + 复习调度 + 周报统计 + 归档 + get_mastery
│   │   └── vector_store.py        # ★ P1 已实现：本地 chromadb 向量记忆，相似题检索
│   ├── remotion/
│   │   ├── animation_service.py   # ★ 异步渲染队列；预置组件 + 生成代码任务
│   │   └── codegen.py             # P2 已实现：生成 TSX 的校验、bwrap preflight 与沙箱渲染（默认关闭）
│   ├── models/
│   │   └── schemas.py             # Pydantic 请求/响应模型（P0 已实现）
│   └── config.py                   # 环境变量读取（CHROMA_PATH / gateway 地址与超时）
├── tests/
│   ├── conftest.py                # 隔离测试数据库与 Chroma 路径，确定性 fake embedding
│   ├── test_memory_record.py      # /memory/record 契约与持久化
│   ├── test_router_compat.py      # 既有 /chat、/animate 兼容性
│   ├── test_crons.py              # P1：调度器生命周期/四类任务/去重/归档/周报组件
│   ├── test_vector_store.py       # P1：幂等 upsert、collection 隔离、相似度排序、导出
│   ├── test_coach_vector_tools.py # P1：fetch/index、error index、top_k 限制
│   ├── test_gateway_client.py     # P1：题目响应归一化与失败降级
│   ├── test_remotion_codegen.py   # P2：静态校验、fail-closed、真实 bwrap/Chrome 冒烟与渲染
│   ├── test_self_improve.py       # P2：推荐记录/迁移/7 天回测/幂等/月报/suggest tool/调度器
│   ├── test_prompts.py            # P3：默认 Soul 回归、目标变体差异、未知回退、FOCUS 静默
│   ├── test_coach_agentscope.py   # AgentScope/ReMe：/chat、FOCUS、session、动画 tool、真实 ReMe 生命周期/写回/检索
├── requirements.txt
```

---

## 3. 记忆、工具与训练调度

本项目将训练历史、知识掌握度、错误模式和长期对话分别保存，AgentScope 工具负责按需读取或更新。ReMe 只管理长期对话记忆。

### 3.1 Memory（记忆）

四类记忆，存储介质各异：

```
┌─────────────────────────────────────────────────────────────┐
│                    记忆系统数据流                              │
└─────────────────────────────────────────────────────────────┘

  用户做题事件                    Agent 主动检索
        │                              │
        ▼                              ▼
  ┌──────────┐   write    ┌──────────────────────┐   read   ┌─────────────┐
  │ 提交结果  │ ─────────▶ │  Episodic 情节记忆    │ ◀────── │  build_     │
  │ (gateway) │            │  (SQLite episodic)    │         │  context_   │
  └──────────┘            └──────────┬───────────┘         │  snapshot() │
       │                             │ update mastery       └──────┬──────┘
       ▼                             ▼                              │
  ┌──────────┐   extract    ┌──────────────────────┐                │
  │ 错误模式  │ ──────────▶ │  Semantic 语义记忆    │ ◀──────────────┘
  │ 分析      │             │  (SQLite semantic)    │
  └──────────┘             └──────────────────────┘
       │                             │
       ▼                             ▼
  ┌──────────┐   upsert    ┌──────────────────────┐   retrieve   ┌─────────┐
  │ 反复出错  │ ──────────▶ │ Procedural 程序记忆  │ ───────────▶ │  SOUL   │
  │ 的模式    │             │ (SQLite procedural) │              │  prompt │
  └──────────┘             └──────────────────────┘              └─────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  Working 工作记忆 = AgentState.context（稳定 session_id） │
  │  ReMe 长期对话记忆 = 进程内 ReMeMiddleware（自动召回/写回）│
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  Vector 向量记忆（P1 已实现）= local chromadb collections │
  │  题目 + 卡点描述嵌入，用于相似题推荐；只写本机 CHROMA_PATH  │
  └──────────────────────────────────────────────────────────┘
```

**记忆更新时机表：**

| 触发事件 | 写入记忆类型 | 字段 | 由谁触发 |
|---------|------------|------|---------|
| 用户提交题目（gateway 回调） | Episodic | problem_id, status, lang, duration, topics | gateway → agent POST `/memory/record` |
| 提交后 agent 复盘 | Episodic.sticking_points | 卡点描述 | agent tool `record_sticking_points` |
| REVIEW 记录卡点 | Vector (`error_description`) | 卡点文本 embedding | `record_sticking_points` → `vector_store.index_error_descriptions` |
| 任何涉及 topic 的做题 | Semantic | mastery ±delta, attempts+1 | `memory.record_attempt` 内部联动 |
| Agent 识别到重复错误 | Procedural | pattern_key, frequency+1 | agent tool `record_sticking_points` |
| 会话每轮对话 | Working | messages 列表 | `coach.chat()` 内部 |
| 题目首次出现 | Vector (`problem_content`) | 题目 embedding | agent tool `fetch_problem_meta` → `vector_store.index_problem`（成功后按进程缓存） |

### 3.2 Skills（技能 = Tools）

工具是 AgentScope 中按需调用的能力单元。本项目用 AgentScope Tool Use 实现。每个 tool 是一个 JSON schema + 一个 Python 执行函数。

**已有 tools（定义在 `coach.py`）：**

| Tool | 用途 | 输入 | 输出 |
|------|------|------|------|
| `get_weakness_topics` | 查询用户薄弱知识点 | threshold?: float | `[{topic, mastery, attempts}]` |
| `request_animation` | 触发 Remotion 动画渲染 | type, topic, title, problem_id? | `{job_id, status}` |
| `record_sticking_points` | 写入复盘卡点，并索引 `error_description` | problem_id, sticking_points[], pattern_key? | `{ok: true}` |
| `fetch_problem_meta` | 调 gateway 取题干；成功后索引 `problem_content`，同一进程内按 slug 缓存，不每轮重复抓取 | slug | `{ok, problem_id, title, difficulty, topics, content}` |
| `get_similar_problems` | 查询本地向量库相似题；可按已索引 `problem_id` 或自由文本查询 | problem_id?, query?, top_k? (≤5) | `{ok, count, results: [{id, document, metadata, distance}]}` |
| `suggest_next_problem` | P2：从薄弱 topic + 到期复习题 + 已索引相似题给出 1–3 条下一题建议；每条都写入 `recommendation_log`，无确认 slug 时退化为 topic-only | topic?, limit? (≤3) | `{ok, count, recommendations: [{id, strategy, topic, problem_id, mastery_before, evaluated_in_days, reason}]}` |

`fetch_problem_meta` 只读取 gateway；FOCUS 模式在 `chat()` 入口直接返回，不进入 tool loop，也不会触发抓取或向量查询。索引失败只记 warning，不影响对话返回。

**新增 tool 规范：**

1. 在 `coach.py` 的 `TOOLS` 列表添加 JSON schema（`name`, `description`, `input_schema`）
2. 在 `AlgoCoach._execute_tool` 添加 `if name == "xxx":` 分支
3. description 要写清楚**何时该用**（Claude 靠这个决定调不调）
4. 输入用具体类型，避免 `any`，必要时加 `enum` 约束

**计划新增 tools：**

| Tool | 触发场景 |
|------|---------|
| 周报生成 | 由 `agent/crons.py` 调度并触发 `WeeklyReport` composition |

`suggest_next_problem` 不调用新外部模型或上游 API：候选只来自本地 `review_schedule`、语义记忆与 ChromaDB 中已存在的题目；`problem_id` 只使用已确认的 LeetCode slug，绝不杜撰。

### 3.3 Soul（灵魂 = System Prompt）

Soul 是 agent 的人格与行为准则，注入 Claude 的 `system` 参数。设计原则：

1. **角色明确**：一句话定义身份（"个性化算法刷题教练"）
2. **模式感知**：明确四种 mode 下该做什么、不该做什么（尤其 FOCUS 静默）
3. **记忆注入**：每次调用前把 `memory.build_context_snapshot()` 结果填入 prompt
4. **风格指令**：简练、有洞察力、中文回复、个性化不泛泛
5. **工具引导**：提示何时主动用动画、何时查弱点

当前 Soul 模板已迁到 `app/agent/prompts.py`，用 `{memory_context}` 占位符注入记忆快照。

**P3 已实现（prompt 集中管理与目标变体）：**

- `SOUL` 保留原 `coach.py` 原文，默认文字、FOCUS 静默、PREP/REVIEW 工具指导与中文风格不变。
- `UserGoal` 枚举定义 `interview_prep` / `contest` / `casual`；`GOAL_GUIDANCE` 只为每种目标**追加**少量有依据的侧重点（面试：复杂度与边界论证；竞赛：约束、正确性证明与复杂度；日常：逐步理解），不删除、不覆盖基础规则与 FOCUS 静默。
- `get_system_prompt(goal)` 返回对应模板；`None`、空串或未知值统一回退到原始 Soul，不抛错。
- `coach.chat()` 在普通请求中采用前端持久化的目标（竞赛阶段优先），未知值退回 `DEFAULT_GOAL`；自动改写 prompt 不在当前范围。

**contest 训练协议（OI / xCPC，本轮已实现）：**

`POST /chat` 增加两个可选字段，`ChatResponse` 与旧请求体不变：

| 字段 | 类型 | 规则 |
|------|------|------|
| `trainingPhase` | str，默认 `auto` | 允许 `virtual_contest` / `topic_drill` / `attempt` / `hint` / `review` / `upsolve`；大小写与首尾空白归一化，未知/空值回退 `auto` |
| `timeRemainingSec` | int \| null，默认 `null` | 可选非负整数；负数、浮点、布尔值返回 422 |

- 显式阶段**或**提供了剩余时间时，`coach.chat()` 选择 `UserGoal.CONTEST`；`auto` 且无剩余时间时保持原来的默认 Soul 与用户消息，非 contest 行为完全不变。
- `CONTEST_PROTOCOL` 描述真实竞赛节奏：读题、题型分类、从数据范围推导复杂度、先拿部分分再优化、赛后 24 小时内补题（upsolve）、正确性证明/不变量优先。
- `PHASE_GUIDANCE` 为每个阶段追加固定立场：`virtual_contest` 只做读题/约束/计分策略；`attempt` 禁止直接答案；`hint` 按 概念 → 不变量 → 伪代码骨架 → 边界 逐级升级；`review` 强制建模、证明/不变量、复杂度、反例；`upsolve` 独立重做并记录卡点；`topic_drill` 用变式检验迁移。
- `time_remaining_note()` 只依赖请求里的秒数（不读系统时钟），按 ≤5 分钟、≤15 分钟、≤45 分钟、更充裕四档给出确定性的节奏提醒。
- 阶段与剩余时间会以 `[竞赛训练上下文] 训练阶段=…；剩余时间=… 秒` 的形式前置到 AgentScope `UserMsg`，因此 `AgentState` 与 ReMe `auto_memory` 写回都包含 phase；同一会话下一轮切换阶段时，系统提示与用户消息都会更新。
- FOCUS 模式的静默检查仍在最前：即使请求带训练阶段/剩余时间，也不创建模型、ReMe 或工具。
- 不新增训练 SQLite 表/列；阶段只存在于请求、进程内 AgentState 与 ReMe 记忆中。

未来扩展：

- 持久化用户目标（DB 列或设置项）并在 `chat` 中传入
- 加入“用户画像摘要”（从 procedural 记忆提炼的常犯错误 top 3）

### 3.4 Crons（定时任务）——P1/P2 已实现

实现位于 `app/agent/crons.py`，由 `app/main.py` 的 FastAPI lifespan 启动/停止。进程内只保留一个 `AsyncIOScheduler`：`start_crons()` 在已运行时直接复用，`shutdown_crons()` 可重复调用；六个 job 使用固定 id，并以 `replace_existing=True`、`max_instances=1`、`coalesce=True` 注册，因此重复启动、服务重载或重叠触发都不会叠加 job。`ALGOCOACH_CRONS_ENABLED=false` 统一关闭全部六个 job。

**配置（均可用环境变量覆盖）：**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ALGOCOACH_TIMEZONE` | `Asia/Shanghai` | 仅决定 cron 触发时刻与通知的“本地日期”标签；数据库时间仍是 naive UTC |
| `ALGOCOACH_CRONS_ENABLED` | `true` | 设为 `false` 关闭调度器，供测试/本地运行使用 |
| `GATEWAY_BASE_URL` | `http://localhost:8080` | 每日一题请求的 Java gateway 地址 |
| `GATEWAY_TIMEOUT_SECONDS` | `10` | 每日一题 HTTP 超时（秒） |

**任务表：**

| 任务 | 触发时间 | 逻辑 |
|------|---------|------|
| 每日一题推送 | 每天 08:00 | `GET {GATEWAY_BASE_URL}/api/problems/daily`；超时、连接错误、非 2xx、非法 JSON 均记日志并跳过当天推送。`build_daily_guide()` 是独立的确定性中文模板，不调用 `coach.chat`，避免污染用户工作记忆。写入 `daily` 通知，去重键 `daily:<本地日期>` |
| 间隔复习推送 | 每天 20:00 | 从 `review_schedule` 查 `due_at <= now` 的记录，按当前 mastery 升序、每天最多 3 道；同一题同一天只推一次（`review:<本地日期>:<problem_id>`）。推送成功后按 SM-2 简化公式重排下次到期，通知节奏下限 2 天，避免同一题每天重复 |
| 周报生成 | 每周日 21:00 | `weekly_stats()` 汇总最近 7 天 episodic；`generate_weekly_summary()` 通过专用 LLM 调用生成中文总结，失败时退回确定性模板；写入 `weekly_report` 通知，去重键 `weekly:<ISO 年>-W<ISO 周>`；随后异步渲染预置 `WeeklyReport` composition（1920×1080、60fps） |
| 记忆整理 | 每天 03:00 | 把 `created_at` 早于 90 天前的 episodic 复制到 `episodic_archive` 并删除热表记录；复制与删除在同一事务提交，可重复执行。**不**修改 semantic mastery（0.005/天只是未来调参方向，未获批准） |
| 推荐效果回测 | 每天 04:00 | 调 `self_improve.evaluate_due_recommendations()`：只评估 `evaluation_due_at <= now` 且尚未评分的 `recommendation_log`；条件更新保证幂等。不写通知、不改权重 |
| 月度策略复盘 | 每月 1 日 04:30 | 调 `self_improve.monthly_strategy_review()`：汇总最近 30 天**已完成评估**的推荐，按 strategy 输出成功率与样本数、生成中文人工建议；只记日志/返回结构，**不自动修改** Soul、prompt、推荐权重或配置，也不写通知 |

**通知与到期状态：**

- `notifications`：`id, type, content, created_at, read, dedupe_key`。`dedupe_key` 为唯一索引；`notify_user(type, content, dedupe_key)` 在唯一冲突时返回 `None`，因此任务重试、进程重启或同日重复触发都不会重复写入同一通知。文档原规格未要求 WebSocket，本轮不做网络推送，也不扩展前端 UI。
- `review_schedule`：`problem_id` 主键，另有 `due_at, interval_days, mastery, attempts, topics, source_episode_id, notified_on, last_notified_at, updated_at`。选择“最新一条有资格”的 episode 作为到期依据：状态不是 `ACCEPTED`（错题/超时等）或 `sticking_points` 非空；普通 `REVIEWED` 且无卡点不算。初始间隔取 `next_review_interval_days(mastery, attempts, 1)`，到期时间 = `episode.created_at + interval`。因此旧记录通常立即到期，新记录会等待一个间隔；调度表按 problem 去重，seed 可重复执行。
- `episodic_archive`：保留原 `episodic.id` 作为主键，使归档复制天然幂等；字段与热表一致并增加 `archived_at`。

**迁移：** `init_db()` 不再只依赖 `create_all`。它先建缺失表，然后对既有表执行可重跑的 `ALTER TABLE ... ADD COLUMN`，并用 `CREATE INDEX IF NOT EXISTS`/`CREATE UNIQUE INDEX IF NOT EXISTS` 补索引（含 `notifications.dedupe_key` 唯一索引与推荐日志的 due/created 索引）；不改写、不删除既有行。已有 `data/agent.db` 可直接启动升级。

**限制：** 调度器按单进程设计；多 worker 部署时每个 worker 都会注册 job，但唯一 `dedupe_key`、每日复习计数与推荐评估的条件更新仍能阻止重复通知/重复评分。周报视频依赖本机 `npx remotion`，渲染失败只记录日志，不会丢失文字周报。

### 3.5 Self-Improve（自我改进）——P2 已实现（人工分析型 MVP）

实现位于 `app/agent/self_improve.py`，目标是用**可解释的离线回测**判断“推出去的题有没有用”，为人工分析提供数据。本轮明确**不**自动调参。

**评估闭环：**

```
suggest_next_problem ──▶ 做题/复习 ──▶ episodic + semantic mastery
        │                                        │
        │ 写 recommendation_log                   │
        │ (strategy/topic/problem_id/             │
        │  mastery_before/created_at/due_at)      │
        ▼                                        ▼
   7 天后 evaluate_due_recommendations ──▶ 对比 mastery
        │                                        │
        └──▶ +1 / 0 / -1 + outcome ◀────────────┘
                    │
                    ▼
   月度 monthly_strategy_review（仅已评样本、显示分母）
                    │
                    ▼
   日志 + 返回人工可读建议；不自动改 Soul/prompt/权重/配置
```

**`recommendation_log` 表（`memory/db.py`）：**

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | INTEGER PK autoincrement | 推荐记录 id |
| `strategy` | TEXT | `due_review`（到期复习题）/ `similar_problem`（本地已索引相似题）/ `topic_only`（无可确认 slug） |
| `topic` | TEXT | 推荐针对的薄弱 topic |
| `problem_id` | TEXT NULL | 确认的 LeetCode slug；topic-only 推荐为 `NULL` |
| `mastery_before` | REAL | 推荐时的 mastery 基线（未知 topic 按项目语义取 0.5） |
| `created_at` | TEXT | naive UTC，推荐时间 |
| `evaluation_due_at` | TEXT | 固定为 `created_at + 7 天` |
| `evaluated_at` | TEXT NULL | 实际评分时间；未评分为 `NULL` |
| `score` | INTEGER NULL | `-1/0/1`，评估前为 `NULL` |
| `outcome` | TEXT NULL | `improved` / `neutral` / `declined` / `abandoned` |
| `mastery_after` | REAL NULL | 按 due 窗口重建、用于评分的 mastery 快照；旧版已评行可为 `NULL` |

迁移沿用 `init_db()` 的 additive 方式：新库由 `create_all` 建表；若存在早期草案版本的 `recommendation_log`，则用可重跑的 `ALTER TABLE ADD COLUMN` 补齐 `strategy` / `evaluation_due_at` / `outcome` / `mastery_after`，并补 due/created 索引。旧行的 `mastery_after` 保持 `NULL`，迁移不重写、不删除既有数据。历史记录没有外键指向 episodic，因此归档或删除 episodic 不会删除推荐历史。

**评分规则（窗口固定为推荐后 7 天，UTC naive 时间）：**

评分**不读取当前 semantic mastery**，而是把结果重建到 `evaluation_due_at` 这一刻，避免 worker 停机后延迟评估时把第 8 天以后的新练习算进来：

1. `now < evaluation_due_at`：**不提前评分**，`score` 保持 `NULL`。
2. 以 `recommendation_log.mastery_before` 为基线，只取 `created_at <= episodic.created_at <= evaluation_due_at` 且 `topics` 包含该 topic 的 `EpisodicRecord` **与** `EpisodicArchive`。
3. 按 `(episodic.created_at, id)` 顺序重放项目现有 ELO 规则：`ACCEPTED` `+0.05`，其余状态 `-0.08`，每步 clamp 到 `[0,1]`，得到 `mastery_after`。
4. 整个窗口内**没有任何该 topic 事件** → 弃做，`-1`，`outcome=abandoned`（此时 `mastery_after = mastery_before`）。
5. 有事件且重建后的 mastery 比基线高 **至少 0.10**（含等号）→ `+1`，`outcome=improved`。
6. 有事件且重建后的 mastery 比基线低 **至少 0.05**（含等号）→ `-1`，`outcome=declined`。
7. 其他（有事件但重建变化未达阈值）→ `0`，`outcome=neutral`。

因此窗口之后的任何活动、以及评估时的 live mastery，都不会改变分数；调度延迟只影响“何时写分数”，不影响“算哪段窗口”。重建值与分数、outcome 一起持久化在 `mastery_after`，便于审计。`memory.get_mastery(topic)` 只用于推荐时捕获基线（未知 topic 返回 `{mastery: 0.5, attempts: 0}`，与 `SemanticNode.mastery` 默认值及既有 `_weakest_snapshot()` 回退一致）。浮点比较带 `1e-9` 容差，保证“恰好 +0.10 / -0.05”按文档判定为成功/失败。

**幂等与并发：** 评分使用单条条件更新 `UPDATE recommendation_log SET ... WHERE id=:id AND evaluated_at IS NULL`，并在 SQLite 事务内提交。并发或重试只有一个更新能生效，后到者读取已存分数返回；已评记录再次调用不会改变 `score`/`evaluated_at`/`mastery_after`。`evaluate_due_recommendations()` 只挑选 `evaluated_at IS NULL` 的行，单行失败记 warning 并继续，不会中断整批。

**归档关系：** 90 天归档边界远大于 7 天评估窗口，正常评估不会因记忆整理丢失证据。窗口事件重建同时读取 `episodic` 与 `episodic_archive`，覆盖服务停机导致评估延迟到归档之后的情况；即使第 10 天才评估，仍只重放 `[created_at, created_at + 7 天]` 内的事件。若 episodic 被直接硬删除（非归档），该次评估只能按“无活动”处理，这是文档化的限制。

**`suggest_next_problem` tool：**

- 目标 topic：默认取 `weak_topics(threshold=0.6)` 最弱的最多 3 个；也接受显式 `topic`。
- 候选优先级：① 落在 `review_schedule` 到期列表且 topics 命中该 topic 的题目；② 本地 ChromaDB `problem_content` 中已索引的相似题（只用已确认 slug）；③ 都没有时退化为 `problem_id=NULL` 的 topic-only 推荐。
- 排除当前正在做的题（`_execute_tool` 自动传入 `problem_id`）；每条实际推荐在返回前写入 `recommendation_log`；`limit` clamp 到 1–3。
- 不调用新外部模型或上游 API；向量库不可用时降级为 topic-only，不虚构题号。

**月度汇总 `monthly_strategy_review(now=...)`：**

- 窗口：`now - 30 天` 至 `now`（滚动窗口，按 `evaluated_at` 归属），只有 `score` 非空的记录参与统计。
- 每个 strategy 输出 `samples`（分母）、`improved/neutral/declined/abandoned`、`success_rate = improved / samples`；`overall` 同样带样本数。
- 建议为确定性中文文本，样本数低于 3 的标准明确写“暂不做判断”；每条建议都显示分子/分母。
- 仅写日志并返回结构；`auto_tuning_applied` 恒为 `False`，不写通知、不改 Soul/prompt/推荐权重/配置。

**cron 接入：** 每天 04:00 执行 due 回测，每月 1 日 04:30 执行月度复盘；固定 job id、`replace_existing=True`、`coalesce=True`、`max_instances=1`，时区与 `ALGOCOACH_CRONS_ENABLED` 与其他 job 完全一致。

**明确限制（MVP）：**

- 没有正式 UI、图表或用户通知；月度报告只落在日志/内部调用返回值。
- 不自动调整推荐权重、不自动改写 Soul/prompt、不自动调整 mastery 参数。
- 评估依赖已有 episodic 与 semantic 数据；“弃做”只是没有活动的代理指标，不能区分用户主动放弃与其他原因。
- `record_sticking_points` 写入的 REVIEWED episode 目前 `topics=[]`，因此只走复盘、没有 gateway 提交记录的活动可能不会被弃做判断计入；正常做题提交带 topics，不受影响。
- topic-only 推荐的 `problem_id` 为空，效果只能按 topic mastery 聚合。

**测试：** `tests/test_self_improve.py` 覆盖迁移可重跑与老数据保留（含 `mastery_after` 旧行为 `NULL`）、未知 mastery 默认 0.5、成功/失败/中性/弃做/窗口未到、阈值边界、按时间/id 重放、延迟评估只取前 7 天（第 8–9 天活动与 live mastery 均不得改变分数）、窗口边界事件、并发与重试幂等、批量重跑、topic-only 与具体题推荐、排除当前题、月度样本数与分母、归档行参与窗口增量重建、调度器重复注册/时区与 cron 入口。全部使用隔离临时 SQLite；向量库用确定性 fake，LLM/HTTP 不参与。

---

## 4. 已有文件详细说明

### `app/main.py`

FastAPI 应用入口。注册 CORS（允许 5173、8080），挂载 agent_router，startup 时 `await init_db()`。

### `app/agent/coach.py`（核心）

`POST /chat` 的运行时已迁移到 **AgentScope 2.0.11**：

```python
class AlgoCoach:
    def __init__(self, *, chat_model=None, reme_middleware=None):
        self._chat_model = chat_model          # AnthropicChatModel（惰性创建）
        self._memory = reme_middleware         # ReMeMiddleware（进程内单实例）
        self._agents: dict[str, Agent] = {}    # 每个稳定 session_id 一个 Agent/AgentState
        self._problem_meta: dict[str, dict] = {}

    async def chat(
        self, session_id: str, message: str,
        mode: str, problem_id: str | None = None,
        *, training_phase: str = "auto",
        time_remaining_sec: int | None = None,
    ) -> dict:  # {"content": str, "animation_id": str | None}

    async def _execute_tool(
        self, name: str, inputs: dict, problem_id: str | None
    ) -> object

    async def close(self) -> None             # 应用关闭时 await ReMeMiddleware.close()
```

**关键逻辑：**
- FOCUS 模式在入口直接返回空 content（硬性静默，不创建模型/ReMe/工具；训练阶段不影响该检查）
- 显式 `training_phase` 或 `time_remaining_sec` 会启用 contest 目标；`auto` 且无剩余时间时沿用默认 Soul，用户消息保持原样
- 训练上下文以 `[竞赛训练上下文] …` 前置到 `UserMsg`，与系统提示中的阶段指导一起进入 AgentScope 状态和 ReMe 记忆
- 每次 chat 前仍用 `memory.build_context_snapshot()` 渲染 Soul 的 `{memory_context}`（SQLite 领域记忆）
- `Agent` 负责 reasoning/acting 循环；`AgentState(session_id=...)` 保存会话上下文，`POST /chat` 使用稳定 `ALGOCOACH_SESSION_ID`（默认 `default`）
- `ReMeMiddleware`（`mode="both"`）在回复后自动 `auto_memory` 写回，并在推理前自动 `search` 召回；`workspace_dir` 默认 `./data/reme`
- 原 `TOOLS` JSON schema/描述保持不变，包装为 AgentScope `FunctionTool`，内部仍走 `_execute_tool`；`request_animation` 通过 ContextVar 回传 `animation_id`
- `main.py` 的 lifespan 在关闭时 `await coach.close()`，停止 ReMe 的文件监听/索引任务

### `app/agent/router.py`

三个端点：
- `POST /chat` → `coach.chat()`，返回 `{content, animationId}`
- `POST /animate` → `animation_service.enqueue()`，返回 `{job_id, status}`
- `GET /animate/{job_id}` → 轮询渲染状态

### `app/memory/db.py`

SQLAlchemy 异步引擎 + 四类记忆表与运维表 ORM：

| 表 | 主键 | 关键字段 |
|----|------|---------|
| `episodic` | id (auto) | problem_id, platform, status, lang, duration_sec, topics(JSON), sticking_points(JSON), created_at |
| `semantic` | topic (str) | mastery(float 0-1), attempts(int), last_seen, weak_subtopics(JSON), related_topics(JSON) |
| `procedural` | id (auto) | pattern_key(unique), description, frequency, last_seen |
| `notifications` | id (auto) | type, content, created_at, read, dedupe_key(unique) |
| `review_schedule` | problem_id | due_at, interval_days, mastery, attempts, topics(JSON), source_episode_id, notified_on, last_notified_at, updated_at |
| `episodic_archive` | id (原 episodic id) | 同 episodic + archived_at |
| `recommendation_log` | id (auto) | strategy, topic, problem_id(NULL), mastery_before, created_at, evaluation_due_at, evaluated_at, score(-1/0/1 NULL), outcome |

`init_db()` 在 startup 调用：`create_all` 建缺失表，随后执行可重跑的 additive 列/索引迁移（见 §3.4），不重写既有行。

### `app/memory/memory_service.py`

**`MemoryService` 单例方法：**

| 方法 | 作用 |
|------|------|
| `record_attempt(...)` | 写 episodic + 联动更新每个 topic 的 semantic mastery |
| `recent_problems(limit)` | 查最近 N 条 episodic |
| `_update_mastery(topic, accepted)` | ELO 更新：+0.05 / -0.08，clamp [0,1] |
| `weak_topics(threshold, top_n)` | 查 mastery < threshold 的 topic，升序 |
| `all_topics()` | 全量知识图谱数据 |
| `get_mastery(topic)` | 单查 topic mastery；未知 topic 返回 `{mastery: 0.5, attempts: 0}` |
| `upsert_pattern(key, desc)` | 程序记忆 upsert，frequency+1 |
| `top_patterns(top_n)` | 查最常见错误模式 |
| `build_context_snapshot()` | **聚合三表**，返回 `{weak_topics, recent_problems, common_mistakes}`，注入 Soul |

### `app/remotion/animation_service.py`

**`AnimationService` 单例：**

| 方法 | 作用 |
|------|------|
| `enqueue(kind, topic, title, problem_id?, component?, props?)` | 建 AnimationJob，`create_task(_render)` 异步启动 |
| `get(job_id)` | 查 job 状态 |
| `_guess_component(topic)` | 关键词匹配 `PREBUILT` dict 选组件 |
| `_render(job_id)` | subprocess 调 `npx remotion render`，超时 120s，成功设 `video_url` |

**`PREBUILT` 组件映射：**

```python
{
  "BFS_GRAPH":      "BfsGraph",
    "DP_TABLE":        "DpTable",
  "SLIDING_WINDOW":  "SlidingWindow",
  "TWO_POINTER":     "TwoPointer",
    }
```

---

## 5. 当前模块实现与约束

### 5.1 `agent/crons.py` —— P1 已实现

实现见 `app/agent/crons.py` 与 §3.4。落地内容：

- `AsyncIOScheduler` 单例 + FastAPI lifespan 启停；固定 job id、`replace_existing`、`max_instances=1`，重复启动/重载不叠加 job。
- 时区 `ALGOCOACH_TIMEZONE`（默认 `Asia/Shanghai`），`ALGOCOACH_CRONS_ENABLED=false` 可关闭。
- `notifications` 表及异步 `memory.notify_user(type, content, dedupe_key)`；唯一去重键保证重试/重启不重复通知。
- `review_schedule` 表、`memory.due_reviews()`、`memory.mark_review_pushed()`；初始 due 从既有 episodic 推导，每日最多 3 道且不重复。
- 每日一题、间隔复习、周报、记忆整理四个任务；周报触发预置 `WEEKLY_REPORT` 视频。
- 不实现 WebSocket 推送或前端 UI（原文档未要求）。

测试：`tests/test_crons.py` 覆盖生命周期/时区/重复注册、四类任务、3 条上限与去重、归档无丢失与幂等、周报 composition 注册。HTTP 与 LLM 全部 mock。

### 5.2 `agent/self_improve.py` —— P2 已实现

推题效果评估。完整语义见 §3.5；落地内容：

- `recommendation_log` 表与可重跑迁移（§3.5 表结构）。
- `memory.get_mastery(topic)` 单查；未知 topic 返回项目默认 `0.5`。
- `log_recommendation(strategy, topic, problem_id, mastery_before=None, now=None)`：写推荐基线并计算固定 7 天 due。
- `evaluate_recommendation(rec_log_id, now=None) -> int | None`：未到窗口返回 `None`；从 `mastery_before` 重放窗口内 `episodic`/`episodic_archive` 事件，得到截至 due 的 mastery 后评分（不读 live mastery）；条件 UPDATE 保证幂等，并保存 `mastery_after`；+1/0/-1 规则见 §3.5。
- `evaluate_due_recommendations(now=None)`：批量评估到期且未评记录，单行失败不影响整批。
- `monthly_strategy_review(now=None)`：滚动 30 天、仅统计已评记录，按 strategy 给出成功率与样本分母，只记日志/返回结构。
- `suggest_next_problem(now=None, limit=3, topic=None, exclude_problem_id=None)`：到期复习题 → 已索引相似题 → topic-only；每条都写日志，不杜撰题号。
- cron 接入：每天 04:00 due 回测、每月 1 日 04:30 月报；与既有 job 共用调度器、时区、关闭开关。

测试：`tests/test_self_improve.py`（隔离 SQLite + fake 向量库，无真实 LLM/HTTP）。

### 5.3 `remotion/codegen.py` —— P2 已实现（默认关闭）

生成式动画把 Agent 产出的 TSX 当作**不可信输入**。静态检查只是纵深防御，真正的安全边界是 Bubblewrap。实现分四层：

**1. 特性开关与 fail-closed**

| 条件 | 行为 |
|------|------|
| 未设置或 `REMOTION_CODEGEN_ENABLED` 不是精确的 `true` | `POST /animate/generated` 返回 503 `SandboxUnavailable: codegen_disabled` |
| 开关打开，但 `REMOTION_CODEGEN_TOKEN` 缺失/为空 | 503 `SandboxUnavailable: codegen_token_missing`；不读取/校验 JSON body，不创建临时文件 |
| 请求缺失/错误 `Authorization: Bearer` | 401 `Unauthorized: invalid_token`（`WWW-Authenticate: Bearer`）；在读取/校验 JSON body、写文件、preflight 之前拒绝；不回显 token |
| 开关打开，但 bwrap/Node/Chrome/systemd-run/Remotion 工程缺失 | 503 `SandboxUnavailable`，理由为具体缺失项 |
| 真实 preflight 任一项失败（namespace、只读挂载、cgroup、超时、输出限制、Chrome 渲染…） | 503 `SandboxUnavailable`，本进程缓存失败结果；**不执行任何生成代码** |
| 排队+渲染中 generated jobs 已达 `REMOTION_CODEGEN_MAX_ACTIVE_JOBS` | 429 `TooManyRequests: generated_job_limit`，不创建临时文件、不启动任务 |
| preflight 全部通过且代码校验通过、容量可用 | 任务入队，异步在沙箱内渲染；轮询 `/animate/{job_id}` 仍沿用原接口 |

访问控制：`REMOTION_CODEGEN_TOKEN` 是启用该功能的必要条件；Bearer token 使用 `hmac.compare_digest` 常量时间比较，校验发生在读取/解析 JSON body、写入临时文件、启动 preflight 之前，日志与响应均不回显 token。

容量控制：活动（QUEUED + RENDERING）generated jobs 受 `REMOTION_CODEGEN_MAX_ACTIVE_JOBS` 限制（默认 1，clamp 到 1–2）。满时 429；失败、超时、取消都会立即释放容量。预置组件队列不受影响。

现有预置组件路径（`request_animation` → `enqueue` → `npx remotion render`）完全未改；生成代码没有任何宿主 `npx`/`node` 回退。

**2. 静态校验（纵深防御，不是安全边界）**

- 代码 ≤ 48 KiB、≤ 600 行、无 NUL；JSON props ≤ 64 KiB、深度 ≤ 8、节点 ≤ 5000、单列表 ≤ 256 项、字符串 ≤ 4000 字符。
- 仅允许 `react` 的 `useMemo`/`useCallback` 与 `remotion` 的 `AbsoluteFill`/`Sequence`/`Series`/`useCurrentFrame`/`useVideoConfig`/`interpolate`/`spring`/`Easing` 具名 import。
- 拒绝动态 import、`require`、`eval`/`Function`、`process`/`globalThis`/`window`/`document`、`fs`/`net`/`child_process`、`fetch`/`WebSocket`、`constructor`/`prototype`、模板字符串、URL scheme、事件处理属性与 `dangerouslySetInnerHTML`。
- 仅允许受限 JSX 元素（`div`/`span`/常见 SVG 元素/`AbsoluteFill` 等）与唯一 `export const GeneratedComposition` 模板。
- 校验发生在创建临时目录、启动任何子进程之前；非法输入直接 400。

**3. Bubblewrap 执行器**

- `--unshare-user/pid/net/ipc/uts`、`--cap-drop ALL`、`--die-with-parent`，根目录 `--remount-ro /`。
- 只读绑定：`/usr`、`/lib*`、`/bin`、`/sbin`、Remotion 工程、生成代码输入目录；可写只有专用 `work/`（bundle、cache、tmp）与 `out/`。
- bwrap `--clearenv` + 固定环境变量；不继承 API key、代理或 secrets。`systemd-run` 自身仅拿到 `XDG_RUNTIME_DIR`/`HOME` 等最小传输变量，bwrap 启动命令前再次清空。
- 每次渲染创建临时 systemd user scope：`MemoryMax=3GiB`、`MemorySwapMax=0`、`TasksMax=512`、`CPUQuota=200%`；另加 rlimit：CPU 240s、单文件 64MiB、fd 256、进程 4096、core 0。
- 硬超时 90s（`REMOTION_CODEGEN_TIMEOUT_SECONDS`，上限 600s）；超时 `killpg` 整个进程组并依赖 PID namespace 回收子进程。
- 输出只接受 `out/render.mp4`：拒绝 symlink、非普通文件、额外文件、非 `ftyp` MP4、>64MiB；composition 由可信 wrapper 固定为 1280×720 / 30fps / 240 帧（8s）。
- 如果 `/usr` 下有可沙箱化的 `ffprobe`，元数据探测也通过同一套 bwrap mounts + systemd cgroup + rlimit + 硬超时在沙箱内执行；**生产路径不在宿主解析不可信 MP4**。若没有可用 ffprobe，则完全跳过元数据探测，仅依赖可信 wrapper 固定规格 + 文件类型/大小校验。
- 成功、失败、超时、取消都在 `finally` 删除临时目录；单进程同时只跑一个生成渲染（信号量 1）。

**4. Preflight 实际检查项**

`namespaces`、`readonly_runtime`、`writable_scratch_only`、`env_scrubbed`、`rlimits`、`cgroup_limits`（读取 transient scope 的 `memory.max`/`memory.swap.max`/`pids.max`/`cpu.max`）、`memory_limit`（64MiB scope 内分配 256MiB 必须被杀）、`process_group`、`timeout_kill`（1s 超时后宿主按 marker 找不到残留进程）、`output_size_limit`（1MiB `RLIMIT_FSIZE` 下写 2MiB 必须失败）、`node`、`remotion_render_smoke`（在沙箱内用可信组件真实渲染一帧 PNG）；另在 ffprobe 可沙箱化时增加 `ffprobe_sandboxed`（沙箱内解析该 PNG 的宽高）。

**配置（均可环境变量覆盖）：**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `REMOTION_CODEGEN_ENABLED` | `false` | 仅精确 `true` 启用；仍需 preflight 通过 |
| `REMOTION_CODEGEN_TOKEN` | 空 | 启用时必填；Bearer token，常量时间比较，不记录/不回显 |
| `REMOTION_CODEGEN_MAX_ACTIVE_JOBS` | `1` | QUEUED+RENDERING generated jobs 上限，clamp 1–2；满时 429 |
| `REMOTION_CODEGEN_TIMEOUT_SECONDS` | `90` | 单次沙箱渲染硬超时，clamp 10–600 |
| `REMOTION_CODEGEN_TMP_ROOT` | 系统临时目录 | 每次渲染的隔离 scratch 父目录 |
| `REMOTION_CODEGEN_BWRAP_BIN` / `_NODE_BIN` / `_CHROME_BIN` | 自动探测 | 可选路径覆盖 |

**运行依赖与限制**

- 需要 `bwrap`（Bubblewrap 0.11.x 实测）以非特权方式运行，不需要 `CAP_SYS_ADMIN`，但操作系统必须允许 unprivileged user namespace。Ubuntu 24.04+ 若开启 `kernel.apparmor_restrict_unprivileged_userns`，需为 bwrap 放行或设为 0；容器需显式允许 user namespace。
- 需要 Node、Chrome/Chromium（`--browser-executable` 传给 Remotion）和可用的 systemd user manager + cgroup v2 的 `memory`/`pids`/`cpu` delegation（`systemd-run --user --scope`）。`systemd-run` 不可用、cgroup 控制器未委派或 `MemorySwapMax` 不支持时直接不可用。
- 当前 `docker-compose.yml` 没有授予上述能力，因此容器内该项保持关闭/不可用；这是预期的 fail-closed 状态，不是“已上线”。
- preflight 探针使用只读绑定 `/usr` 中的 `/usr/bin/python3`；镜像缺少该路径时功能保持不可用（fail-closed），不会改走宿主执行。
- 未启用 seccomp；未挂载 `/sys`，因此沙箱进程无法操作 cgroup 文件逃离 scope。Chrome 仍以 `--no-sandbox` 运行在 bwrap 的 namespace 内。
- 生产路径不再用宿主 ffprobe 解析生成的 MP4；只有测试代码会为独立验证自行解析产物。
- 静态扫描是词法级、保守白名单，存在误杀可能；它不能替代 bwrap。
- 输出内容仍是不可信的媒体文件，只按固定字节/元数据上限校验，未做视频内容审核。

### 5.4 `memory/vector_store.py` —— P1 已实现

本地 chromadb 向量记忆，用于相似题目与错误模式检索。实现使用锁定版本 `chromadb==0.5.3`，不访问任何云 embedding API，也不上传题目或用户卡点。

**配置：**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CHROMA_PATH` | `../../data/chroma` | ChromaDB 持久化目录；容器内为 `/data/chroma`（见 `docker-compose.yml`） |

**Collections（每类独立命名空间，避免跨类型召回噪声）：**

| Collection | 内容 | 写入时机 |
|-----------|------|---------|
| `problem_content` | 题目题干（title + topic + 题干前 500 字符） | `fetch_problem_meta` 首次成功抓取后 |
| `topic_explanation` | 知识点解释文本 | 提供幂等 API；当前无调用方，留给动画 props 生成 |
| `error_description` | `record_sticking_points` 写入的卡点文本 | REVIEW 阶段记录卡点后 |
| `solution_comment` | — | **V2，未创建**：REVIEW 追问尚无明确数据来源 |

**接口（`VectorStore`，进程级单例 `vector_store`）：**

```python
await vector_store.upsert(collection, [VectorRecord(id, document, metadata)])  # 幂等
await vector_store.query(collection, "文本", top_k=5, where={"platform": "LEETCODE"})
await vector_store.index_problem(problem_id, title, content, topics, platform="LEETCODE")
await vector_store.index_topic_explanation(topic, explanation)
await vector_store.index_error_descriptions(problem_id, sticking_points)
await vector_store.find_similar_problems("binary search")
await vector_store.similar_to_problem("two-sum", top_k=5)   # 排除自身
await vector_store.get(collection, record_id)
await vector_store.count(collection)
```

**语义与限制：**

- **幂等**：`id` 即幂等键。题目用 `problem_id`；topic/error 用文本 SHA-1 前缀，重复 upsert 只更新原行，不新增。
- **懒初始化**：构造 `VectorStore` 不建目录、不导入模型；首次索引/查询才创建 `PersistentClient` 与 collection。
- **embedding**：默认使用 Chroma 本地 ONNX `all-MiniLM-L6-v2`（384 维）。首次索引/查询时初始化，第一次使用会把约 80 MB 模型下载到 `~/.cache/chroma`，之后可离线使用；不经过云 API。也可用 `VectorStore(embedding_function=...)` 注入本地模型或测试用确定性 embedding。
- **遥测**：`Settings(anonymized_telemetry=False)`，禁用 Chroma 匿名遥测。
- **返回边界**：query 默认 `top_k=5`、硬上限 10；返回 document 截断到 500 字符；coach tool 进一步限制为最多 5 条。
- **metadata**：`id`, `problem_id`, `title`, `topic`（逗号连接）, `platform`, `created_at`；题目可带 `difficulty`。`where` 可直接做等值过滤。
- **降级**：chromadb 缺失或本地目录打不开时抛 `VectorStoreUnavailable`；coach 的相似题 tool 返回 `{ok: false, error}`，索引是 best-effort，不阻断对话。
- **安装注意**：Python 3.12 没有 `chroma-hnswlib==0.7.3` 的预编译 wheel，`pip install chromadb==0.5.3` 会从源码构建它（需要 C++ 工具链）；Python 3.11 有现成 wheel。
- **迁移限制**：同一 collection 内不能混用不同维度的 embedding。更换 embedding 模型/维度后需删除并重建 `CHROMA_PATH` 下的 collection；当前没有自动迁移。

### 5.5 `models/schemas.py`

Pydantic 完整模型，从 router.py 的内联 BaseModel 抽出集中管理。

```python
from pydantic import BaseModel, Field
from typing import Optional, Literal

class ChatRequest(BaseModel):
    message: str
    mode: Literal["IDLE", "PREP", "FOCUS", "REVIEW"]
    problemId: Optional[str] = None
    # 允许 auto / virtual_contest / topic_drill / attempt / hint / review /
    # upsolve；校验器把未知或空值归一化为 auto（旧客户端可省略）。
    trainingPhase: str = "auto"
    timeRemainingSec: Optional[int] = Field(default=None, ge=0)

class ChatResponse(BaseModel):
    content: str
    animationId: Optional[str] = None

class AnimateRequest(BaseModel):
    type: Literal["PRE_EXPLAIN", "SOLUTION_COMPARE", "CONCEPT"]
    topic: str
    title: str
    problemId: Optional[str] = None

class AnimationJobResponse(BaseModel):
    id: str
    status: Literal["QUEUED", "RENDERING", "READY", "FAILED"]
    videoUrl: Optional[str] = None
    title: str

class RecordAttemptRequest(BaseModel):
    problem_id: str
    platform: Literal["LEETCODE", "LUOGU", "CODEFORCES"]
    status: Literal["ACCEPTED", "WRONG_ANSWER", "TIME_LIMIT", "RUNTIME_ERROR", "COMPILE_ERROR"]
    lang: str
    duration_sec: int
    topics: list[str]
    sticking_points: list[str] = []
```

---

## 6. /chat Agent 流程图（AgentScope + ReMe）

```
POST /chat {message, mode, problemId, trainingPhase?, timeRemainingSec?}
        │
        ▼
 mode == "FOCUS"? ──yes──▶ return {content: "", animationId: null}
        │ no                 （不创建模型 / ReMe / 工具）
        ▼
 resolve trainingPhase（未知→auto）+ 选择 goal
   ├─ 显式阶段或剩余时间 ▶ contest 协议 + 阶段指导 + 剩余时间提醒
   └─ auto 且无剩余时间   ▶ 原默认 Soul（行为不变）
        │
        ▼
 UserMsg("[竞赛训练上下文] 训练阶段=…；剩余时间=… 秒\n" + message)
 AgentState(session_id=ALGOCOACH_SESSION_ID).agent.reply(UserMsg)
        │
        ├─ ReMe on_reply: 后台 search（自动召回）
        ├─ ReMe on_reasoning: 将检索到的记忆以 HintBlock 注入下一次推理
        ├─ Agent 执行 reasoning/acting 循环：
        │    FunctionTool(get_weakness_topics / request_animation /
        │                 record_sticking_points / fetch_problem_meta /
        │                 get_similar_problems / suggest_next_problem)
        │    → _execute_tool(...)（内部逻辑与迁移前一致）
        │    request_animation 通过 ContextVar 记录 animation_id
        └─ ReMe on_reply finally: auto_memory 按 session_id 写回本轮增量
        │
        ▼
 return {content: final_msg.get_text_content(), animation_id}
```

应用关闭时 `main.py` lifespan 调用 `await coach.close()`；AgentScope 不管理
middleware 生命周期，因此必须显式关闭进程内 ReMe app。

---

## 7. 四类记忆数据模型与更新时机

见 3.1 节的更新时机表。这里补充字段细节。

**Episodic（情节记忆）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int auto | 主键 |
| problem_id | str(64) | LeetCode titleSlug |
| platform | str(16) | LEETCODE / LUOGU / CODEFORCES |
| status | str(32) | ACCEPTED / WRONG_ANSWER / ... |
| lang | str(16) | rust / cpp / python3 |
| duration_sec | int | FOCUS 模式耗时 |
| topics | Text(JSON) | 涉及知识点列表 |
| sticking_points | Text(JSON) | 复盘时 agent 填的卡点 |
| created_at | str(32) | ISO 时间 |

**Semantic（语义记忆）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| topic | str(64) | 主键，如 "BFS" |
| mastery | float | 0-1，越高越熟 |
| attempts | int | 该 topic 做题次数 |
| last_seen | str(32) | 最近一次做题时间 |
| weak_subtopics | Text(JSON) | 细分弱点，如 ["dijkstra","拓扑排序"] |
| related_topics | Text(JSON) | 前置依赖 topic |

**Procedural（程序记忆）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int auto | 主键 |
| pattern_key | str(128) | 唯一标识，如 "off_by_one_in_sliding_window" |
| description | Text | 人类可读描述 |
| frequency | int | 出现次数 |
| last_seen | str(32) | 最近一次 |

---

## 8. ELO Mastery 评分算法

当前实现（`_update_mastery`）：

```python
delta = 0.05 if accepted else -0.08
mastery = clamp(mastery + delta, 0.0, 1.0)
attempts += 1
```

**设计依据：**

- **不对称**：失败扣分（0.08）大于成功加分（0.05），因为做对一道题不能证明掌握，但做错更能说明不熟
- **线性**：MVP 用线性增减，简单可解释。未来可改进方向：
  - 考虑题目难度（Hard 通过加分 > Easy 通过加分）
  - 时间衰减（长期没碰的 topic mastery 自然回落）
  - 贝叶斯估计（基于 attempts 数给置信区间，少样本时变化更保守）

**调参方向：**

- 把 delta 值抽到配置，方便 A/B 测试
- 引入难度权重：`delta *= difficulty_weight[EASY=0.7, MEDIUM=1.0, HARD=1.5]`
- 引入时间衰减：`mastery *= 0.99 ^ days_since_last`，在每次 build_context 时应用

---

## 9. Remotion 渲染流水线

```
  enqueue(kind, topic, title)
         │
         ▼
  ┌─────────────────────┐
  │  创建 AnimationJob   │
  │  status = QUEUED     │
  │  存入 _jobs dict     │
  └──────────┬──────────┘
             │  asyncio.create_task(_render)
             ▼
  ┌─────────────────────┐
  │  status = RENDERING  │
  │  out_path = mp4 路径  │
  └──────────┬──────────┘
             ▼
  ┌─────────────────────────────────────┐
  │  subprocess: npx remotion render     │
  │    --props {component, data}         │
  │    --output out_path                 │
  │    MainComp                          │
  │    cwd=remotion-compositions/        │
  │  超时 120s                           │
  └──────────┬──────────────────────────┘
             │
        ┌────┴────┐
        ▼         ▼
    returncode=0  else
        │         │
        ▼         ▼
  ┌─────────┐  ┌─────────────┐
  │ READY   │  │ FAILED      │
  │ video_  │  │ error = stderr│
  │ url设置 │  └─────────────┘
  └─────────┘
```

**超时处理**：`asyncio.wait_for` 包裹 `proc.wait()`，超时则 `proc.kill()` 并标记 FAILED。

**失败重试**：MVP 不自动重试。未来可加：FAILED 状态下前端可点「重试」按钮，重新 enqueue 同参数 job。

**视频服务**：MP4 输出到 `/data/animations/{id}.mp4`。前端通过 gateway 的只读静态资源路由 `/animations/{id}.mp4` 访问；该映射已实现（P2，见 gateway 文档 §4.9），本地默认读取仓库根 `data/animations`，容器读取共享挂载的 `/data/animations`。

---

## 10. 与 Java Gateway 的接口契约

Agent 需要调 gateway 获取题目元数据（不直接调 LeetCode）：

| Agent 调用 | Gateway 端点 | 用途 |
|-----------|-------------|------|
| `GET /api/problems/{slug}` | 同名 | 获取题目详情（agent 用于 PREP 讲解） |
| `GET /api/problems/daily` | 同名 | 每日一题推送 |

Gateway 需要调 agent 写记忆：

| Gateway 调用 | Agent 端点 | 用途 |
|-------------|-----------|------|
| `POST /memory/record` | 已实现（Agent 侧） | 用户提交后，gateway 把 Submission + duration 回调给 agent 写 episodic |

**`POST /memory/record` 契约（Agent 和 Gateway 回调已接通）：**

```json
// Request
{
  "problem_id": "two-sum",
  "platform": "LEETCODE",
  "status": "ACCEPTED",
  "lang": "rust",
  "duration_sec": 480,
  "topics": ["Array", "Hash Table"]
}

// Response
{ "ok": true }
```

正式提交终态写入 Gateway SQLite 后，`SubmissionService` 会把题目 slug、平台、状态、语言、FOCUS 用时和缓存题目标签回调到该端点。成功后 Agent 调 `memory.record_attempt(...)`，新增 episodic 记录并联动更新 semantic mastery。回调失败或 2 秒超时会记录不含敏感字段的警告，不会撤销 Gateway 已保存的提交；需要观察 Agent 服务可用性时使用本地日志和记忆查询。

前端通过 Gateway `GET /api/agent/memory/profile` 读取进度概览；Gateway 固定代理至 Agent `GET /memory/profile`。响应包含 semantic 节点、同题共现边、35 天提交计数、最近提交和汇总指标，不包含代码或 Cookie。设置页通过 `GET /api/agent/memory/export` 下载 SQLite 记忆表、Chroma 向量文档以及 ReMe/Chroma 本地文件；Gateway 的提交历史另存 JSON，Cookie 不导出。

---

## 11. 安全考虑

### 生成 JSX 的沙箱（P2 已实现，默认关闭）

详见 §5.3。要点：

1. **安全边界是 bwrap + systemd scope + PID/网络/user namespace**，不是 AST/import 检查；静态检查只负责尽早拒绝明显恶意输入。
2. **fail-closed**：preflight 无法证明隔离属性、或启用后缺少 `REMOTION_CODEGEN_TOKEN` 时返回 `SandboxUnavailable`，没有宿主执行回退。
3. **访问控制**：启用时必须提供 Bearer token，`hmac.compare_digest` 常量时间比较；在 JSON body 解析、写文件、preflight 之前拒绝，日志/响应不回显 token。
4. **容量控制**：活动 generated jobs 默认最多 1（clamp 1–2），满时 429；失败/超时/取消立即释放；预置队列不受影响。
5. **环境清洗**：不继承 `ANTHROPIC_API_KEY`、代理变量或其他 secrets；只绑定运行所需只读系统路径与专用可写目录。
6. **资源与输出上限**：memory/swap/pids/cpu 由 cgroup 强制，file size/fd/CPU/core 由 rlimit 强制，墙钟超时后整组 kill；输出必须是固定规格、有限大小的 MP4。
7. **不可信 MP4 不在宿主解析**：ffprobe 元数据探测也在同一 bwrap + cgroup + rlimit + 超时内运行；没有可沙箱化 ffprobe 时跳过探测，仅依赖固定 wrapper + 类型/大小校验。
8. **临时目录清理**：成功、失败、超时、取消都清理；单任务串行，避免资源叠加。
9. **现有预置组件链路不变**：生成代码仅通过 `/animate/generated` 进入，且默认关闭。

### subprocess 命令注入防护

预置组件链路继续用 `asyncio.create_subprocess_exec`（不是 `shell=True`），参数以列表传递，`props` 用 `json.dumps` 序列化。生成链路同样只传参数列表；生成代码从不拼进 shell 命令，只作为只读文件挂载进沙箱。

额外加固：

- 预置组件仍校验 `component` 在 `PREBUILT` 白名单内
- 渲染进程 cwd 锁定在 `remotion-compositions` 目录
- 生成代码的 composition 尺寸/时长/fps 由可信 wrapper 固定，生成文件无法修改

## 12. 测试策略

| 层级 | 工具 | 重点 |
|------|------|------|
| 单元 | pytest | memory_service 的 ELO 计算、weak_topics 查询、tool 执行 |
| 集成 | pytest + httpx.AsyncClient | router 各端点，用 fake AgentScope 模型 |
| Mock | `tests/conftest.py` 的 `FakeChatModel` / `RecordingReMe` | 不调用真实模型；断言工具调用、FOCUS、稳定 session、ReMe search/auto_memory 调用 |
| 动画 | 手动/冒烟 | 跑通一次 BfsGraph 渲染，验证 mp4 产出 |
| 生成代码沙箱 | pytest + 真实 bwrap/systemd/Chrome | 静态校验、token/容量、fail-closed、临时目录清理、真实 namespace/cgroup/超时/输出限制、沙箱内 ffprobe 与一次完整 MP4 渲染 |
| 自我改进 | pytest + 隔离 SQLite + fake 向量库 | 迁移重跑与老数据保留、7 天窗口重建（延迟评估不读窗口外活动）、+1/0/-1/弃做/阈值边界、并发与重试幂等、topic-only/具体题推荐、月度样本分母、归档行参与重放、调度器注册 |
| Prompt 变体 | pytest（纯单元） | 默认 Soul 逐字回归、三种目标内容差异、未知值回退、FOCUS 模式不调用模型或 tool |
| 竞赛训练协议 | pytest（纯单元 + fake AgentScope/ReMe） | `trainingPhase` 默认值与六阶段、大小写归一化、未知回退 `auto`、`timeRemainingSec` 非负/布尔校验、router 透传、非 contest 不受影响、剩余时间分档、FOCUS 仍静默、phase 进入 fake 模型的用户消息与 ReMe 写回 |
| AgentScope/ReMe | pytest + fake 模型 + 真实 ReMe 生命周期 | `/chat` 契约、FOCUS 静默、稳定 session、动画 tool、ReMe search/auto_memory 调用、真实 ReMe app start/close、真实写卡 + reindex + search、lifespan close |

**关键测试用例：**

```python
# tests/test_coach_agentscope.py
async def test_focus_route_returns_before_model_memory_and_tools(client, ...):
    resp = await client.post("/chat", json={"message": "help", "mode": "FOCUS"})
    assert resp.json() == {"content": "", "animationId": None}
    assert model.calls == [] and reme.jobs == []

async def test_chat_executes_animation_tool_and_returns_job_id(...):
    # FakeChatModel 第一轮返回 tool_call(request_animation)，第二轮返回 text
    result = await coach.chat("s1", "讲讲BFS", "PREP")
    assert result["animation_id"] == "job-42"

async def test_real_reme_auto_memory_write_and_search(tmp_path):
    # 真实 ReMeMiddleware：auto_memory 写 daily card，reindex 后 search 命中
    ...
```

**CI 已实现：** `.github/workflows/ci.yml` 在 Python 3.12 下运行 Ruff、Mypy 与 pytest；其余 jobs 覆盖 Java 21 Gateway、前端 Vitest coverage/build、Remotion typecheck/bundle。

---

## 13. 实现优先级

| 优先级 | 模块 | 状态 / 说明 |
|--------|------|-------------|
| P0 | `models/schemas.py` | ✅ 已完成并复核：抽出 Pydantic 模型，router 不再内联 |
| P0 | `POST /memory/record` 端点与 Gateway 回调 | ✅ 已完成：终态提交持久化后 best-effort 回调 Agent，传递题目 slug、标签和训练用时；回调失败不影响提交结果 |
| P1 | `agent/crons.py` | ✅ 已实现：通知、间隔复习、周报、90 天归档 |
| P1 | Remotion 周报视频 | ✅ 本轮已实现：`WeeklyReport` 1920×1080/60fps 预置 composition |
| P1 | `memory/vector_store.py` | ✅ 本轮已实现：本地 ChromaDB（`CHROMA_PATH`）、三类 collection、幂等 upsert/query、懒加载本地 embedding、禁用遥测 |
| P1 | `fetch_problem_meta` / `get_similar_problems` tools | ✅ 本轮已实现：gateway 题干抓取 + 索引、本地相似题检索、卡点索引；`solution_comment` 仍为 V2 |
| P2 | `remotion/codegen.py` | ✅ 已实现并本机实测：bwrap + systemd scope 沙箱、真实 preflight、静态校验、输出限制；默认关闭、未上线，Docker 内保持不可用 |
| P2 | `agent/self_improve.py` | ✅ 本轮已实现（人工分析型 MVP）：`recommendation_log`、按 due 窗口重建 mastery 的 7 天回测（保存 `mastery_after`）、月度 strategy 汇总、`suggest_next_problem` tool、两个 cron job；自动调权/提示词改写/正式 UI/通知仍未实现 |
| P3 | `prompts.py` | ✅ 本轮已实现：Soul 集中管理、`UserGoal` + `get_system_prompt(goal)` 变体、未知回退；coach 接收浏览器偏好目标，显式竞赛阶段优先 |
| P3 | `/chat` contest 训练协议 | ✅ 本轮已实现：`trainingPhase` / `timeRemainingSec` 可选字段、六阶段指导、OI/xCPC 读题-分类-约束-部分分-补题节奏、剩余时间提醒、phase 进入 AgentScope 消息与 ReMe 记忆；无新 SQLite，`ChatResponse` 不变 |
