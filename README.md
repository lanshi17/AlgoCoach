# AlgoCoach — OI / xCPC 算法训练教练

AlgoCoach 是一个本地优先的算法训练工作台。它把题目、编辑器、判题、AI 教练、训练记忆和知识库放进同一条闭环：先读题建模，再进入安静的 FOCUS 解题，提交后按判题事实、训练记录和当前代码进行 REVIEW。

项目当前适合个人本地使用和持续迭代，默认不托管账号数据，也不要求单独部署向量数据库或 ReMe 服务。前端只连接 Java Gateway，AI 逻辑运行在 Python Agent，平台 Cookie 留在 Gateway 的本地 SQLite 中。

## 当前实现状态

| 能力 | 状态 | 入口 |
|------|------|------|
| LeetCode CN 题目、运行、提交 | 已实现 | 工作区 / Gateway |
| AcWing、HDU 题库浏览 | 已实现 | 工作区题目选择器 |
| PREP / FOCUS / REVIEW 训练阶段 | 已实现 | 工作区 |
| REVIEW 读取当前提交代码 | 已实现 | 提交后自动复盘、聊天面板 |
| AgentScope 2.0.11 + ReMe 长期记忆 | 已实现 | Python Agent |
| 本地 Chroma 向量检索 | 已实现 | 相似题、错误和知识库 |
| 网页知识库与自定义 Embedding | 已实现 | `/knowledge/library` |
| Monaco 本地代码补全 | 已实现 | 编辑器 |
| 本地练习本与离线桌面工作区 | 已实现 | 工作区 / 刷题进度 |
| 本地 Python 样例运行 | 初步实现 | 两道内置题；自定义输入显示返回值，尚无完整判题 |
| 本地 SM-2 风格复习调度 | 初步实现 | 借鉴 DeepTutor 的可解释冷启动规则；用户自评后安排下一次复习 |
| 本地练习同步 Agent 记忆 | 初步实现 | 在线时同步，离线保留重试队列；幂等键避免重复记忆；样例结果分开记录 |
| DeepTutor 式 Workspace 学习空间 | 已实现 | `/learning/dashboard`（学习页“学习记录”入口） |
| macOS / Linux 桌面壳 | 初步实现 | `desktop/`；Linux x86_64 包已验证，macOS arm64 由 runner 构建检查 |
| 预置 Remotion 动画 | 可选，默认关闭 | `REMOTION_ENABLED=true` |
| 生成式动画沙箱 | 可选，默认关闭 | 需要额外安全运行环境 |

## 五分钟了解项目

1. 打开前端后默认进入侧栏的“学习空间”（`/home`，分阶段引导式学习页）；要从“本地练习本”开始写代码，进入“编码练习”（`/workspace`）。网关未启动时仍可保存草稿、专注时间和本地进度。
2. 在设置页配置模型 Provider；需要使用 LeetCode、AcWing 时再粘贴对应 Cookie。
3. 在题目选择器中按平台、专项、难度或关键词选题。已 AC 的 LeetCode 题默认隐藏，可随时打开显示。
4. PREP 阶段让教练解释概念、约束和建模方向。
5. 点击开始做题进入 FOCUS。教练保持静默，编辑器继续提供本地语法和常用结构补全。
6. 运行样例或提交代码。提交成功后进入 REVIEW，教练会读取当前语言和代码，结合判题结果分析正确性、边界、复杂度和下一步。

## DeepTutor 二创方向

本项目借鉴 [DeepTutor](https://github.com/HKUDS/DeepTutor) 的本地优先教学闭环、Workspace、Capability/Tool 分层和可解释练习调度，把学习对象换成算法与代码：

```
选择学习模式 → 今日摘要 → Agent 推荐练习 → 写代码 → 判题 / 自测 → 复盘 → 知识图谱与下一轮计划
```

`/learning/dashboard`（从学习页的“学习记录”进入）是 Workspace 的当前 UI 表现层，目前包含今日摘要、继续练习、复盘队列、知识地图、本周计划/任务板和 Agent 洞察；`/home` 是分阶段引导式学习页，`/notebook` 提供独立的本地学习笔记。计划可以安排下一页练习或到期复盘，在本机调整任务顺序、添加备注并标记完成。算法 Agent 继续复用现有题库、Monaco 编辑器、判题、REVIEW 和知识图谱；这些 Block 是可替换的视图组件，业务边界由 Workspace、Capability、Tool、练习记录和对话 turn 定义。

`desktop/` 提供 macOS / Linux Electron 壳，发布顺序为 macOS Apple Silicon arm64、macOS Intel x64、Linux x86_64。开发时它启动 Vite 并把 `/api`、`/animations` 转发到本地 Gateway；设置 `ALGOCOACH_AUTOSTART_SERVICES=1` 后会尝试管理本地 Gateway / Agent 子进程，生产打包入口已经准备好。

本项目是对 DeepTutor 的独立适配：复用其公开的架构理念和实践调度思路，并以算法题目、代码练习和现有 Agent 流程重新组织。DeepTutor 采用 Apache License 2.0；对应许可文本见 [`frontend/public/licenses/DeepTutor-Apache-2.0.txt`](frontend/public/licenses/DeepTutor-Apache-2.0.txt)，适配边界见 [`docs/deeptutor-adaptation.md`](docs/deeptutor-adaptation.md)。

## 仓库结构

```text
frontend/                 React + Vite 工作区、题目面板、Monaco、AI 聊天
backend/gateway/          Java 21 + Spring Boot Gateway
backend/agent/            Python 3.12 + FastAPI + AgentScope + ReMe
remotion-compositions/    预置算法动画和周报动画
docs/                     架构、后端、前端、记忆和动画设计文档
data/                     本地运行时数据（SQLite、Chroma、ReMe、MP4）
.github/workflows/ci.yml  Agent、Gateway、Frontend、Remotion 四组 CI
```

## 架构概览

```
frontend/          React + Vite + Monaco Editor + Remotion Player
backend/
  gateway/         Java 21 + Spring Boot 3 — LeetCode GraphQL 代理、题目/提交 API
  agent/           Python 3.12 + FastAPI — AgentScope 2.0.11 agent + ReMe 长期记忆、Remotion 生成
remotion-compositions/  15 种 Remotion 算法 / 解法对比动画
data/              SQLite 数据库 + 渲染出的 MP4 动画
```

## 服务入口与主要 API

| 服务 | 地址 | 负责内容 |
|------|------|----------|
| Frontend | `http://localhost:5173` | 浏览器工作区和设置页 |
| Gateway | `http://localhost:8080` | LeetCode、AcWing、HDU 代理与本地提交记录 |
| Agent | `http://localhost:8000` | AgentScope 对话、训练记忆和知识库；通常只通过 Gateway 访问 |

常用路由如下：

| 路由 | 作用 |
|------|------|
| `GET /api/problems` | LeetCode 题目列表和筛选 |
| `GET /api/problems/{titleSlug}` | 题面、代码模板和样例 |
| `POST /api/run` / `POST /api/submit` | 运行样例、提交并轮询判题 |
| `GET /api/submissions` | 本地提交历史 |
| `POST /api/agent/chat/stream` | 流式 AI 教练对话；REVIEW 可携带当前代码 |
| `POST /api/agent/chat/replay` | 按 turnId/事件序号恢复已持久化的 Agent 对话事件 |
| `GET /api/agent/memory/mastery-path` | 按当前 workspace 返回有序的下一步学习路径、到期复习和解释 |
| `GET/PUT /api/agent/knowledge/config` | 读取或保存知识库 Embedding 配置 |
| `POST /api/agent/knowledge/sources` | 上传知识库源文件 |
| `POST /api/agent/knowledge/reindex` | 重建用户知识库向量索引 |

前端始终访问 Gateway 的 `/api` 路径。直接访问 Agent 端口主要用于本地调试和健康检查。当前 workspace 默认是本机 `local-default`，可在设置页创建或切换本地 workspace；练习本、复盘队列、学习空间布局、任务板和草稿会沿用对应 workspace 的本地数据。

## 核心设计原则

| 阶段 | AI 状态 | 说明 |
|------|---------|------|
| PREP  | ✅ 全功能 | 讲知识点、主动触发 Remotion 动画、自由对话 |
| FOCUS | 🔒 完全静默 | 进入后 AI 不发任何消息；编辑器只用 Monaco 本地语言辅助，不连接外部 LSP 或 AI 补全 |
| REVIEW | ✅ 全功能 | 按判题结果、用时、题目标签与训练记录做结构化复盘并更新记忆 |

## 记忆与训练

- **工作记忆** — AgentScope `AgentState` 按浏览器页面会话和题目隔离上下文；刷新页面会开启新的短期对话
- **长期对话记忆** — AgentScope `ReMeMiddleware` 在 Agent 进程内写回各会话记录，并跨会话检索相关卡片；存于本地 `REME_WORKSPACE_DIR`（默认 `./data/reme`），不启动独立服务
- **情节记忆** — 每题做题记录，存 SQLite `episodic` 表
- **语义记忆** — 知识点掌握图谱，ELO 式 mastery 评分，SQLite `semantic` 表
- **程序记忆** — 用户常见错误模式，SQLite `procedural` 表
- **向量记忆** — 题目题干、知识点解释与卡点 embedding，存本地 ChromaDB（`CHROMA_PATH`），用于相似题推荐与重复错误检索；只写本机，默认使用本地 embedding 模型，不调用云 embedding API
- **用户知识库** — `/knowledge/library` 支持通过网页配置本地或自定义 OpenAI-compatible embedding，上传 TXT/Markdown/JSON/CSV/HTML/PDF/DOCX/ZIP 源文件并建立独立向量索引；文件和 Provider 密钥只保存在本机 `KNOWLEDGE_DIR`
- **自我改进回测** — 记录推荐并在 7 天窗口后按训练事件评估效果，提供月度策略汇总；只生成分析结果，不自动修改 prompt 或推荐权重。
- **Prompt 目标** — 提供 `interview_prep`、`contest`、`casual` 三种系统提示词目标；竞赛训练阶段通过 `/chat/stream` 请求选择。
- **OI / xCPC 训练协议** — `/chat/stream` 支持 `virtual_contest`、`topic_drill`、`attempt`、`hint`、`review`、`upsolve` 阶段和剩余时间提醒，指导读题建模、约束推导、部分得分、逐级提示与赛后复盘。
- **模型 Provider** — 设置页提供 OMP 风格的主流 Provider 预设与自定义 OpenAI/Anthropic-compatible 端点；API key 仅在当前浏览器会话中使用，不写入训练导出或 Git。
- **题库与专项训练** — LeetCode 按专项（动态规划、图论、二分……）和难度筛选，列表与题面来自 GraphQL；AcWing 作为额外渠道，专项映射到其算法标签（走站内搜索），打开题目附六语言 starter 模板，需要配置 Cookie；杭电 HDU 提供题单浏览与题面，可匿名浏览。运行/提交仍只支持 LeetCode。

提交后，Gateway 会把判题事实、用时和题目标签写入 Agent 记忆；进入 REVIEW 时，前端还会把当前编辑器代码和语言作为本轮临时上下文发送给 Agent。代码用于当次复盘，不写入 ReMe 长期记忆；Agent 会区分能从代码直接验证的问题和需要测试确认的风险。

## Remotion 动画组件

可选功能，默认关闭（`REMOTION_ENABLED=true` 启用）。关闭时 coach 不注册 `request_animation` tool、Soul 去掉动画指引、`POST /animate` 返回 503 `AnimationDisabled`——每次 `/chat/stream` 因此少一份工具 schema 与提示词 token。

Agent 通过 `request_animation` tool 主动触发，渲染后嵌入聊天面板。

| 组件 | 用途 |
|------|------|
| `BfsGraph` / `GridBfs` | 图遍历与网格最短路 |
| `DfsTree` / `Dijkstra` | 深度优先遍历与单源最短路 |
| `DpTable` / `BacktrackingTree` | 状态转移与回溯搜索 |
| `SlidingWindow` / `TwoPointer` / `BinarySearch` | 数组区间、双指针与二分查找 |
| `UnionFind` / `LinkedListOps` | 连通分量与链表指针操作 |
| `HeapSort` / `SortVisualizer` | 堆排序与插入排序过程 |
| `SolutionCompare` | 解法思路与复杂度对比 |
| `WeeklyReport` | 本地训练周报视频 |

渲染出的 MP4 由网关以只读静态资源提供：Agent 返回的 `/animations/{jobId}.mp4` 可在网关
8080 上直接访问（支持 Range 拖动）。本地按 README 从 `backend/gateway` 启动时，
默认读取仓库根 `data/animations`（`animations.location=file:../../data/animations/`）；
docker-compose 设置 `ANIMATIONS_LOCATION=file:/data/animations/`，与 agent 的
`OUTPUT_DIR=/data/animations` 共用 `./data:/data` 挂载。

### 生成式动画（P2，默认关闭）

`POST /animate/generated` 可把 Agent 生成的 TSX/JSX 交给 Remotion 渲染，但生成代码始终按不可信输入处理，且**默认不开放**：

- 只有显式 `REMOTION_CODEGEN_ENABLED=true` 才启用；即使启用，还必须配置 `REMOTION_CODEGEN_TOKEN`，请求带 `Authorization: Bearer <token>`（常量时间比较）。缺少 token 配置时 fail-closed，未授权请求在读取/校验 JSON body 前返回 401。
- 首次请求必须通过真实的 Bubblewrap preflight：user/pid/net/uts namespace、非 root、只读根目录、仅 `work`/`out` 可写、环境变量清洗、rlimit、systemd user scope 的 memory/pids/cpu 上限、超时整组 kill、输出大小限制、Node + Remotion + Chrome 实际渲染一帧；若存在位于 `/usr` 的可沙箱化 ffprobe，还会验证它在沙箱内解析一帧。
- 生成的 MP4 只允许固定 1280×720/30fps/240 帧，并通过文件类型/大小校验；ffprobe 元数据解析也在同一个 bwrap + cgroup 沙箱内运行，不在宿主解析不可信文件。无可用 ffprobe 时跳过元数据复核，仅依赖可信 wrapper 的固定规格。
- 生成任务有固定小容量（`REMOTION_CODEGEN_MAX_ACTIVE_JOBS`，默认 1，最多 2）；排队+渲染中任务满时返回 429，不创建临时文件、不启动任务。预置组件队列不受影响。
- 任何一项无法证明都会 fail-closed 返回 `SandboxUnavailable`，**不会**回退到宿主机 `npx`/`node` 执行；预置组件动画不受影响。
- 运行依赖：`bwrap`（允许非特权 user namespace）、Node、Chrome/Chromium、systemd user manager 及 cgroup v2 的 memory/pids/cpu delegation。当前 `docker-compose.yml` 未授予这些能力，容器内该项会保持不可用。

实现与限制见 `backend/agent/app/remotion/codegen.py`、`docs/backend-agent.md` §5.3 与 `docs/remotion.md` §5。

## 配置要点

| 环境变量 | 默认值 | 用途 |
|----------|--------|------|
| `ANTHROPIC_API_KEY` | 无 | 直接调用 Agent 且未发送请求级 Provider 时使用的 API key |
| `CLAUDE_MODEL` | `claude-opus-5-5` | 直接调用 Agent 且未发送请求级 Provider 时使用的默认模型 |
| `GATEWAY_BASE_URL` | `http://localhost:8080` | Agent 访问 Gateway 的地址 |
| `DB_PATH` | `./data/agent.db` | Agent SQLite 路径 |
| `CHROMA_PATH` | `./data/chroma` | 训练向量存储路径 |
| `REME_WORKSPACE_DIR` | `./data/reme` | ReMe 本地 workspace |
| `KNOWLEDGE_DIR` | `./data/knowledge` | 用户知识库源文件和配置 |
| `REMOTION_ENABLED` | `false` | 是否启用预置动画工具 |
| `ALGOCOACH_SYNC_TOKEN` | 无 | 自动跨设备同步 hub 的共享令牌；留空时 `POST /memory/sync` 返回 503 |
| `ALGOCOACH_ALLOWED_ORIGINS` | 无 | 额外允许访问 Gateway `/api/**` 的 Origin，逗号分隔；跨设备自动同步时需要 |

完整变量和注释见 [.env.example](.env.example)。API key、Cookie 和用户知识库文件都属于本地运行时数据，不应提交到 Git。

## 快速启动

```bash
# 1. 复制环境变量
cp .env.example .env
# 填写 ANTHROPIC_API_KEY

# 2. 启动三个服务（Gateway 使用 Maven；AgentScope/ReMe 在 Python 进程内运行）
docker compose up --build
```

打开 http://localhost:5173 即可进入工作区。使用 LeetCode 或 AcWing 题库时再配置相应 Cookie；HDU 可以匿名浏览。

## 本地验证

```bash
cd frontend && bun install --frozen-lockfile && bun run test:coverage && bun run build
cd ../remotion-compositions && bun install --frozen-lockfile && bun run build
cd ../backend/agent && python -m pip install pytest==9.2.0 pytest-asyncio==1.5.0 mypy==1.18.2 ruff==0.15.17
python -m pytest -q && ruff check --isolated app tests && mypy app --ignore-missing-imports --follow-imports=silent
cd ../gateway && mvn test  # 需要 Java 21
```

CI 定义在 `.github/workflows/ci.yml`：Agent 使用 Python 3.12（pytest 9.2.0、pytest-asyncio 1.5.0、Ruff 0.15.17、Mypy 1.18.2），Gateway 使用 Java 21（Maven test），前端与 Remotion 使用 Bun 1.4.4（Vitest coverage、TypeScript/Vite build、Remotion typecheck/bundle）。

## 提交代码前

- 先确认工作区只包含与当前改动相关的文件，`data/` 中的本地数据库、Cookie、向量索引和 MP4 不应提交。
- 后端改动至少运行 Agent 测试、Ruff、Mypy；Gateway 改动运行 Java 21 的 `mvn test`。
- 前端改动运行 Vitest 和生产构建；编辑器、聊天、设置等交互改动应补充对应组件测试。
- 修改 API 请求体时同步更新 Pydantic schema、TypeScript 类型、Gateway 代理文档和 README 的 API 表。
- 涉及记忆或知识库时确认数据边界：训练记忆、用户知识库和提交源码不能意外混入同一 collection 或长期记忆。

提交信息使用简短的动作描述，例如 `fix: keep review code ephemeral` 或 `feat: add solved problem marker`。

Compose 镜像构建检查（不启动服务，也不调用 LeetCode 或模型 API）：

```bash
cp .env.example .env  # 若此前尚未创建 .env
docker compose config --quiet
docker compose build
```

实际启动前，请在 `.env` 中填写 `ANTHROPIC_API_KEY`；题库 Cookie 可在设置页按需录入。

## LeetCode Cookie 获取方式

1. 浏览器打开 leetcode.cn 并登录
2. F12 → Network，刷新页面后右键请求 → Copy → Copy as cURL (bash)
3. 把完整 curl 粘贴到 AlgoCoach 设置页

设置页只提取 `LEETCODE_SESSION` 和 `csrftoken`，完整 curl 不会保存、不会发送给 Agent。

Cookie 明文只存在本机 Gateway 的 SQLite；Gateway 只把它附加到发往 `leetcode.cn` 的请求，不会发送给 Agent 或 AI 服务。

## 当前边界

- LeetCode CN 支持题面、运行、提交和提交历史；AcWing、HDU 当前用于题库浏览和题面阅读。
- 运行与提交必须由用户在工作区主动触发；Agent 不会代替用户提交代码。
- 单用户本地部署是当前数据模型，多账号、OAuth、团队协作和云端同步不在当前范围内。
- 代码执行由题库平台负责；Agent 不在宿主机执行用户代码。
- 生成式动画保持默认关闭；当前 Compose 没有授予 Bubblewrap/cgroup 所需能力，容器内该路径会保持不可用。

进度、知识图谱、间隔复习、周报动画、本地向量检索、自我改进回测与 OI/xCPC 训练阶段均已进入当前实现。

## 文档索引

- [系统架构](docs/architecture.md) — 服务边界、数据流和运行时职责
- [Agent 设计](docs/backend-agent.md) — AgentScope、ReMe、记忆和动画端点
- [Gateway 设计](docs/backend-gateway.md) — LeetCode 代理、Cookie、提交和缓存
- [前端设计](docs/frontend.md) — 工作区状态、编辑器和交互约束
- [记忆系统](docs/memory-system.md) — SQLite、Chroma 和 ReMe 的数据模型
- [Remotion 设计](docs/remotion.md) — 预置动画和生成式沙箱

## 参考开源项目

- [skygragon/leetcode-cli](https://github.com/skygragon/leetcode-cli) — LeetCode API 参考
- [JacobLinCool/LeetCode-Query](https://github.com/JacobLinCool/LeetCode-Query) — TS LeetCode 库
- [Remotion](https://www.remotion.dev) — 程序化视频渲染
