# AlgoCoach — OI / xCPC 算法训练教练

围绕 LeetCode 训练闭环构建：Python AgentScope 负责训练对话，AgentScope 的 ReMeMiddleware 负责长期对话记忆；Java Gateway 仅处理 LeetCode 登录态、题目与提交代理。训练按 PREP、FOCUS、REVIEW 进行，FOCUS 中 Agent 保持静默。

## 架构概览

```
frontend/          React + Vite + Monaco Editor + Remotion Player
backend/
  gateway/         Java 21 + Spring Boot 3 — LeetCode GraphQL 代理、题目/提交 API
  agent/           Python 3.12 + FastAPI — AgentScope 2.0.11 agent + ReMe 长期记忆、Remotion 生成
remotion-compositions/  15 种 Remotion 算法 / 解法对比动画
data/              SQLite 数据库 + 渲染出的 MP4 动画
```

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
- **自我改进回测** — 记录推荐并在 7 天窗口后按训练事件评估效果，提供月度策略汇总；只生成分析结果，不自动修改 prompt 或推荐权重。
- **Prompt 目标** — 提供 `interview_prep`、`contest`、`casual` 三种系统提示词目标；竞赛训练阶段通过 `/chat` 请求选择。
- **OI / xCPC 训练协议** — `/chat` 支持 `virtual_contest`、`topic_drill`、`attempt`、`hint`、`review`、`upsolve` 阶段和剩余时间提醒，指导读题建模、约束推导、部分得分、逐级提示与赛后复盘。
- **模型 Provider** — 设置页提供 OMP 风格的主流 Provider 预设与自定义 OpenAI/Anthropic-compatible 端点；API key 仅在当前浏览器会话中使用，不写入训练导出或 Git。
- **题库与专项训练** — LeetCode 按专项（动态规划、图论、二分……）和难度筛选，列表与题面来自 GraphQL；AcWing 作为额外渠道，专项映射到其算法标签（走站内搜索），打开题目附六语言 starter 模板，需要配置 Cookie；杭电 HDU 提供题单浏览与题面，可匿名浏览。运行/提交仍只支持 LeetCode。

Submit 后只把判题事实、用时和题目标签发给 Agent；提交源码发往 LeetCode，不会自动转发给模型。因此当前复盘不声称已检查用户代码。

## Remotion 动画组件

可选功能，默认关闭（`REMOTION_ENABLED=true` 启用）。关闭时 coach 不注册 `request_animation` tool、Soul 去掉动画指引、`POST /animate` 返回 503 `AnimationDisabled`——每次 `/chat` 因此少一份工具 schema 与提示词 token。

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

## 当前范围

当前只接入 LeetCode CN；多平台适配、多账号与 OAuth 尚未纳入实现。代码执行与提交必须由用户在工作区主动触发。设置页支持语言/教练目标/主题偏好和本地数据导出。

进度、知识图谱、间隔复习、周报动画、本地向量检索、自我改进回测与 OI/xCPC 训练阶段均已进入当前实现。生成式动画保持默认关闭，且容器未授予运行所需的 Bubblewrap/cgroup 能力。

## 参考开源项目

- [skygragon/leetcode-cli](https://github.com/skygragon/leetcode-cli) — LeetCode API 参考
- [JacobLinCool/LeetCode-Query](https://github.com/JacobLinCool/LeetCode-Query) — TS LeetCode 库
- [Remotion](https://www.remotion.dev) — 程序化视频渲染
