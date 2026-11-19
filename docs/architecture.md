# AlgoCoach 系统架构文档

> 三服务架构：React 前端 + Java 网关 + Python Agent，职责严格分离，通过 HTTP 通信。

---

## 1. 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         用户浏览器                                    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  React Frontend  :5173                                       │   │
│  │                                                              │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │   │
│  │  │ Sidebar  │  │  Problem     │  │   Editor (Monaco)     │  │   │
│  │  │ Nav      │  │  Panel       │  │   Focus Mode 🔒       │  │   │
│  │  └──────────┘  └──────────────┘  └───────────────────────┘  │   │
│  │                                                              │   │
│  │  ┌────────────────────────┐  ┌──────────────────────────┐   │   │
│  │  │  Chat Panel (Agent)    │  │  Animation Card          │   │   │
│  │  │  FOCUS → 锁定          │  │  Remotion Player         │   │   │
│  │  └────────────────────────┘  └──────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│           │ /api/*                        │ /api/agent/*             │
└───────────┼───────────────────────────────┼─────────────────────────┘
            │                               │
            ▼                               │
┌───────────────────────┐       ┌───────────┴───────────────────────┐
│  Java Gateway  :8080  │◄──────│  Python Agent  :8000              │
│  Spring Boot 3        │       │  FastAPI + AgentScope 2.0.11 + ReMe│
│                       │       │                                   │
│  • LeetCode 代理      │       │  • AgentScope Agent loop          │
│  • Cookie 管理        │       │  • ReMe 自动召回/写回             │
│  • 题目缓存 / 提交轮询│       │  • 四类领域记忆 + 向量检索          │
│                       │       │  • Remotion 渲染队列 / Tool Use    │
│  • SQLite (gateway)   │       │  • SQLite (agent)                 │
└───────────────────────┘       └───────────────────────────────────┘
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────────────────┐
│  LeetCode CN GraphQL  │       │  Remotion CLI (npx)               │
│  https://leetcode.cn  │       │  → 生成 MP4                       │
│  /graphql             │       │  → /data/animations/*.mp4         │
└───────────────────────┘       └───────────────────────────────────┘

                        共享卷
            ┌──────────────────────────┐
            │  /data/                  │
            │  ├── algocoach.db        │  ← gateway SQLite
            │  ├── agent.db            │  ← agent SQLite
            │  └── animations/         │  ← Remotion 输出
            └──────────────────────────┘
```

---

## 2. 三服务职责边界

### 2.1 Java Gateway（:8080）— 只做数据代理和持久化

**能做**：
- 代理 LeetCode GraphQL 请求（注入 Cookie）
- 缓存题目数据（`problem_cache` 表，TTL 24h）
- 代理提交到 LeetCode，轮询结果
- 存储提交记录（`submission_record` 表）
- 存储 Cookie（`user_cookie` 表）
- 在提交记录入库后 best-effort 通知 agent 新提交结果（Gateway 直连 Python `/memory/record`；最多等待 2 秒，失败不影响已保存的提交）

**不能做**：
- ❌ 调用 Claude API（AI 逻辑在 agent 层）
- ❌ 生成动画
- ❌ 管理对话历史
- ❌ 决定下一道推荐题目

### 2.2 Python Agent（:8000）— 只做 AI 逻辑和记忆

**能做**：
- 管理 AgentScope agent 会话（reasoning/acting loop；按页面会话、平台和题目隔离短期上下文，IDLE/PREP/REVIEW 阶段连续共享）
- 四类记忆读写（episodic/semantic/procedural + ReMe 对话记忆）
- 触发 Remotion 渲染任务
- 决定推题策略

**不能做**：
- ❌ 直接调用 LeetCode API（通过 gateway 中转）
- ❌ 持久化用户代码（提交源码由 LeetCode 处理；REVIEW 代码只作为 Agent 本轮临时上下文）
- ❌ 在 FOCUS 模式下发送任何消息

### 2.3 React Frontend（:5173）— 只做界面和状态

**能做**：
- 渲染 UI、管理 Zustand 状态
- 控制 AgentMode 状态机切换
- 在 FOCUS 模式隐藏聊天输入框
- 轮询动画任务状态

**不能做**：
- ❌ 直接调用 LeetCode（必须经 gateway）
- ❌ 在 FOCUS 模式发送消息到 agent（前端强制封锁）
- ❌ 存储任何敏感数据（Cookie 在 gateway 侧）

### 2.4 单一入口原则

**每个功能只保留一个入口**：一个函数或端点负责该功能的开关判定、状态写入和副作用，其他调用方只能调用它，不得各自再判一次。

| 功能 | 唯一入口 |
|------|----------|
| 预置动画触发 | `animation_service.enqueue` — chat 的 `request_animation`、`POST /animate`、周报 cron 全部调用它；`REMOTION_ENABLED` 只在这里判定，调用方只把 `AnimationDisabled` 映射成自己的返回形态（tool 错误 / 503 / 静默跳过） |
| 生成代码动画 | `POST /animate/generated` — 开关与 Bearer 鉴权都在端点、早于 body 解析；服务层 `enqueue_generated` 只做容量与沙箱 |
| 平台 Cookie | `POST /api/platforms/{platform}/cookie` — 设置页与统一登录页共用 |
| Provider 配置 | `useAppStore.setProvider` — 桌面默认 Ollama/Qwen，本地优先；预设与手填都走同一个 setter |
| 记忆写入 | `memory_service` 的对应方法（`record_attempt` 等） |
| 题目原文 | `gateway.fetch_problem` — 自带进程内缓存，tool 与路由复用同一结果 |

判定规则：

1. 能力开关（如 `REMOTION_ENABLED`）只在入口里读一次；调用方看到的是类型化异常，不是第二个 `if`。
2. “是否暴露”的读取（工具 schema、system prompt 片段）可以出现在展示层，但必须读同一个 `app.config` 函数，不得复制判定逻辑。
3. 新增触发/写入路径时先问：能不能调用既有入口？不能才新增入口，并删除旧路径。

---

## 3. 数据流图

### 3.1 拉取题目流程

```
前端 GET /api/problems/{slug}
        │
        ▼
Java Gateway
  ┌─ 查 problem_cache 表 ──► HIT? → 直接返回 JSON
  │
  └─ MISS → 调用 LeetCode GraphQL
                │
                ▼
         questionData query
                │
                ▼
         写入 problem_cache (TTL 24h)
                │
                ▼
         返回题目 JSON → 前端
```

### 3.2 提交代码流程

```
用户点击「提交」
        │
        ▼
前端 POST /api/submit { slug, code, lang }
        │
        ▼
Java Gateway
  1. POST to LeetCode submitSolution mutation
     → 拿到 submission_id
  2. 轮询 checkSubmission(submission_id)
     每 2s 一次，最多 30s
  3. 拿到最终状态 (ACCEPTED / WA / ...)
  4. 写入 submission_record 表
  5. POST Python `/memory/record`（gateway 内部调用；最多等 2 秒，失败只记日志）
  6. 返回 SubmissionDTO 给前端
        │
        ▼
前端 mode → REVIEW
        │
        ▼
用户开始对话 → agent REVIEW 逻辑
```

> **当前实现状态（P0）**：Agent 侧 `POST /memory/record` 与 Gateway `SubmissionService`
> 回调均已实现。提交终态写入 gateway SQLite 后，把题目 slug、状态、语言、FOCUS 用时和
> 题目标签送到 Agent；Agent 写入 episodic 并更新 semantic mastery。Agent 不可用时最多等待
> 2 秒后仍返回已保存的提交结果，稍后可在本地记忆库核对是否写入。

### 3.3 Agent 对话流程

```
前端 POST /api/agent/chat/stream { message, mode, conversationId, workspaceId?, capability?, turnId?, afterSequence?, problemId, goal?, trainingPhase?, timeRemainingSec?, code?, codeLanguage? }
        │
        ▼
Java Gateway 固定代理 → FastAPI router.py
        │
        ▼
coach.chat(session_id, message, mode, problem_id)
        │
  if mode == FOCUS → 立即返回 ""（静默）
        │
        ▼
memory.build_context_snapshot()
  ├── weak_topics (semantic 表)
  ├── recent_problems (episodic 表)
  └── common_mistakes (procedural 表)
        │
        ▼
组装 system prompt (OI/xCPC 训练目标 + SQLite 领域记忆快照)
        │
        ▼
AgentScope Agent (AnthropicChatModel, claude-opus-5-5)
  with tools=[get_weakness, request_animation, record_sticking_points, ...]
        │
  ┌─ tool_call? → FunctionTool 执行 → 追加 tool_result → 下一轮 reasoning
  │
  └─ 无 tool_call → 提取最终文本
        │
        ▼
AgentState 保存当前页面和题目的会话上下文（session_id 由 workspaceId / conversationId / platform / problemId 派生；当前模式每轮更新到系统提示）；turn 事件同时写入本地 SQLite，支持已完成对话 replay。
ReMeMiddleware 在 workspace 专属本地目录自动 search 召回 + 按 session_id auto_memory 写回
        │
        ▼
返回 { content, animation_id? } → Gateway → 前端
```

前端只连接 Gateway；Agent 的 `/chat/stream`、`/memory/record`、`/memory/profile` 和动画端点由 Gateway 通过固定上游地址代理。ReMeMiddleware 随 AgentScope 进程运行，`local-default` 写入 `REME_WORKSPACE_DIR`，其他 workspace 写入哈希子目录，不需要单独启动 ReMe 服务。

### 3.4 动画生成流程

```
coach._execute_tool("request_animation", {...})
        │
        ▼
animation_service.enqueue(kind, topic, title, problem_id)
  → 创建 AnimationJob { id, status=QUEUED }
  → asyncio.create_task(_render(job_id))   ← 后台渲染
        │
        ▼
返回 { job_id, status="QUEUED" } 给 coach
coach 把 animation_id 放入流式 done 事件
        │
        ▼
前端收到 animation_id
  → 渲染 AnimationCard（骨架屏状态）
  → 轮询 GET /api/agent/animate/{job_id} 每 3s
        │ (后台同时在渲染)
        ▼
_render 完成：
  1. npx remotion render MainComp --props {...} --output /data/animations/{id}.mp4
  2. job.status = "READY"
  3. job.video_url = "/animations/{id}.mp4"
        │
        ▼
前端轮询拿到 status=READY
  → AnimationCard 切换为 <video> 自动播放
```

---

## 4. AgentMode 状态机

### 状态定义

| 状态 | 描述 | 进入条件 |
|------|------|---------|
| `IDLE` | 未选题，可自由对话 | 初始状态；从 REVIEW 跳转到新题 |
| `PREP` | 题目已加载，知识讲解阶段 | 用户选择题目后自动进入 |
| `FOCUS` | 专注解题，AI 完全静默 | 用户点击「开始做题」按钮 |
| `REVIEW` | 提交后复盘分析 | 提交代码拿到结果后自动进入 |

### 转换图

```
         选题
  IDLE ──────► PREP
   ▲              │ 点击「开始做题」
   │              ▼
   │           FOCUS
   │              │ 提交成功（任意结果）
   │              ▼
   └────────── REVIEW
       选下一题
```

### 前端动作与 API 约束

前端按钮按当前模式门控；Gateway 的 Run/Submit 请求本身不携带 `mode`，因此不能在服务端判断 PREP/FOCUS。FOCUS 静默由前端和 Agent `/chat/stream` 双重保证。

| API / 前端动作 | IDLE | PREP | FOCUS | REVIEW |
|-----|------|------|-------|--------|
| GET /api/problems | ✅ | ✅ | ✅ | ✅ |
| POST /api/run（前端按钮） | — | — | ✅ | — |
| POST /api/submit | ❌ | ❌ | ✅ | ❌ |
| POST /agent/chat/stream | ✅ | ✅ | ❌(静默) | ✅ |
| POST /agent/animate | ✅ | ✅ | ❌ | ✅ |

---

## 5. 安全设计

### 5.1 Cookie 存储安全

- Cookie 只存在 gateway 本地 SQLite（单用户本地部署）。
- 不经过任何第三方服务器。
- 多用户扩展时：加密存储（AES-GCM，密钥来自用户密码派生的 PBKDF2）。
- Cookie 录入：前端接收浏览器 Copy as cURL (bash)，只提取 `LEETCODE_SESSION` 与 `csrftoken` 后提交 Gateway；完整 curl 不保存、不发给 Agent。Cookie 失效时 Gateway 清空 Cookie，前端收到 `COOKIE_EXPIRED` 后跳转设置页。

### 5.2 Remotion 代码沙箱

默认链路只使用预置组件，Agent 只能传 JSON props，不执行任意代码。另有默认关闭的 `POST /animate/generated`：必须显式启用并配置 Bearer token；每次运行前都要通过 Bubblewrap、namespace、只读挂载、资源限制、systemd user scope/cgroup、Node 与 Chrome 的真实隔离检查。输入/输出校验和 ffprobe 解析都在沙箱内；任一条件不成立即 fail-closed，不回退到宿主执行。当前 Compose 未授予所需能力，因此容器中生成式路径保持不可用。详细约束见 `docs/remotion.md` §5 和 `docs/backend-agent.md` §5.3。

### 5.3 SQL 注入防护

所有查询使用 SQLAlchemy ORM 或 parameterized query，不拼接字符串。

```python
# ✅ 正确
session.execute(select(SemanticNode).where(SemanticNode.topic == topic))

# ❌ 禁止
cursor.execute(f"SELECT * FROM semantic WHERE topic = '{topic}'")
```

### 5.4 CORS 配置

```python
# agent/app/main.py
app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # 生产改为实际域名
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],  # conversationId / platform 位于 JSON body
)
```

```java
// gateway CorsConfig.java
@Bean
CorsConfigurationSource corsConfigurationSource() {
    var config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("http://localhost:5173"));
    config.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    // ...
}
```

---

## 6. 部署架构

### 6.1 本地开发（三终端启动）

```bash
# 终端 1
cd backend/gateway && mvn spring-boot:run

# 终端 2
cd backend/agent && python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 终端 3
cd frontend && bun install --frozen-lockfile && bun run dev
```

Vite 开发服务器将 `/api` 代理到 Java Gateway `:8080`；Gateway 再将 `/api/agent/*` 代理到 Python Agent `:8000`。

### 6.2 Docker Compose（本地 / 单机）

```bash
cp .env.example .env  # 首次启动时创建，并填写 ANTHROPIC_API_KEY
docker compose up --build
```

本地端口为前端 `5173`、Gateway `8080`、Agent `8000`。Gateway 负责 `/api/*` 与 `/animations/*`，动画请求支持 Range；容器通过共享 `/data` 卷保存 SQLite、向量索引、ReMe 工作区和动画文件。

### 6.3 云部署（V2 参考）

```
用户 → CloudFront CDN
           ├── /animations/* → S3（Remotion 输出上传 S3）
           └── /* → ELB
                      ├── /api/*   → ECS (Java Gateway)
                      └── /api/agent/* → API Gateway → ECS (Python Agent)
                      └── /*       → S3 Static (React build)
```

---

## 7. 扩展点：接入新平台

实现 `PlatformAdapter` 接口：

```java
// gateway/platform/PlatformAdapter.java
public interface PlatformAdapter {
    Mono<JsonNode> fetchProblem(String problemId);
    Mono<JsonNode> listProblems(ProblemFilter filter);
    Mono<SubmissionResult> submit(String problemId, String code, String lang);
    Mono<SubmissionResult> pollSubmission(String submissionId);
    boolean isAuthenticated();
}

当前没有通用 `PlatformAdapter` 抽象；仅实现 LeetCode CN。洛谷与 Codeforces 不属于当前范围。
```

Python agent 侧无需改动，题目数据格式统一由 gateway 转换。

---

## 8. 配置中心

运行变量以根目录 `.env.example`、Gateway 的 `application.yml` 与 Compose 环境段为准。`.env.example` 列有 AgentScope/ReMe、SQLite、ChromaDB、Crons、Gateway 地址和默认关闭的生成式动画沙箱配置。LeetCode Cookie 通过设置页写入本机 Gateway SQLite，不放进 `.env`。

---

## 9. 监控和日志策略

### 日志规范

```python
# agent 侧 — Python 标准 logging
import logging
log = logging.getLogger(__name__)

log.info("chat.request session_id=%s mode=%s", sid, mode)
log.info("tool.call tool=%s problem_id=%s", name, problem_id)
log.error("render.failed job_id=%s error=%s", job_id, e)
```

```java
// gateway 侧 — SLF4J + Logback
log.info("problem.fetch slug={} cached={}", slug, cached);
log.warn("leetcode.ratelimit retry={}", retry);
log.error("submit.timeout submissionId={}", id);
```

### 关键指标（未来接入 Prometheus）

| 指标 | 类型 | 含义 |
|------|------|------|
| `agent_chat_duration_ms` | Histogram | Claude 响应耗时 |
| `render_job_duration_ms` | Histogram | Remotion 渲染耗时 |
| `leetcode_api_errors_total` | Counter | LeetCode API 错误数 |
| `mastery_update_total` | Counter | 知识点 mastery 更新次数 |
| `focus_mode_duration_sec` | Histogram | 用户专注时长分布 |

---

## 10. 当前范围与后续边界

### 当前实现

- ✅ LeetCode CN Cookie 认证、题目搜索/详情、Run/Submit/历史与 Cookie 失效处理
- ✅ Monaco 工作区、FOCUS 下 AI 静默、累计专注计时；目前使用 Monaco 本地语言功能，不启动外部 LSP
- ✅ AgentScope + ReMe 对话记忆，SQLite 训练记忆、ChromaDB 本地向量检索、知识图谱和进度页
- ✅ OI/xCPC 六阶段指导、赛后复盘、定时复习、周报和推荐效果回测
- ✅ 15 种预置 Remotion 动画与受限生成式渲染接口；生成式接口默认关闭，当前 Compose 未开放其所需的沙箱能力

FOCUS 期间当前只累计专注用时，不保存编辑轨迹。Submit 后把判题事实、用时与题目标签交给 Agent；进入 REVIEW 时，前端把当前代码和语言作为临时请求上下文发送给 Agent。代码不写入 ReMe 长期记忆，复盘可以检查本轮实际提供的代码。

### 明确不在当前范围

- 洛谷、Codeforces 等其他平台，多账号与云端部署
- 外部 LSP/AI 代码补全、移动端、Prometheus 指标
- 自动修改 Soul、Prompt 或推荐权重；回测仅产生人工可读结果
- `solution_comment` 向量 collection（目前没有稳定的数据来源）
