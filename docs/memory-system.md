# AlgoCoach 记忆系统详细设计

> 越用越懂你弱点的核心机制。本文档描述 AgentScope + ReMe 与本地刷题记忆的实现，以及四类记忆的完整数据模型、更新时机和检索策略。

---

## 1. 记忆模块与服务边界

| 模块 | 存储 / 职责 |
|---|---|
| 工作记忆 | AgentScope `AgentState`，按页面会话 + 平台 + 题目隔离，训练阶段连续共享 |
| 长期对话记忆 | AgentScope ReMeMiddleware，本地 workspace；各会话写回，跨会话检索 |
| 情节 / 语义 / 程序记忆 | Agent SQLite |
| 向量记忆 | 本地 ChromaDB |
| 定时任务 | Agent APScheduler |
| 回测 | 推荐日志窗口评估，不自动调权 |

---

## 2. 四类记忆详细设计

### 2.1 工作记忆（Working Memory）

**存储位置**：AgentScope `AgentState`（Python 进程内存），按浏览器页面会话、平台和题目隔离；IDLE/PREP/REVIEW 阶段共享上下文。

```python
# app/agent/coach.py
Agent(state=AgentState(session_id=session_id))
# router.py 用 ALGOCOACH_SESSION_ID 作为命名空间前缀，并对 conversationId、平台、题目生成独立 session_id
# 对话上下文由 AgentState.context 持有，AgentScope 按模型上下文窗口压缩
```

**长期对话记忆**：官方 `ReMeMiddleware` 进程内嵌入 ReMe，`mode="both"`：
- 回复开始时后台 `search`，在后续推理前把相关记忆以 `HintBlock` 注入；
- 回复结束后通过 `auto_memory` 按 `session_id` 自动写回；
- 记忆卡片存 `REME_WORKSPACE_DIR`（默认 `./data/reme`）；写回按 AgentScope session_id 标记，检索在 workspace 范围内跨会话进行。

**静态算法知识库**：Agent 启动时从仓库根目录的 `01-算法套路.md.zip` 和 `editor/` 幂等生成 Markdown，放到 ReMe 的 `digest/wiki/algorithm-library/`。ReMeMiddleware 同时启用本地 MiniLM 向量模型（384 维，复用 Chroma 的 ONNX `all-MiniLM-L6-v2`）和 BM25 关键词索引，向量索引保存在 ReMe workspace 的 metadata 下；首次创建 ReMeMiddleware 时，Coach 在第一次搜索前显式调用 ReMe `reindex` job，避免后台 watcher 首轮扫描尚未结束造成漏检。检索能同时命中算法套路原文、图像引用、C++/Rust/TypeScript 历史题解和代码模板。设置 `REME_VECTOR_ENABLED=false` 可退回纯关键词模式。导入器只清理自己上次登记的陈旧文件，不改写其他日记、摘要或记忆卡。导入清单和生成结果均位于该知识库子目录。

**用户目标**：设置页将 `contest` / `interview_prep` / `casual` 偏好写入浏览器本地存储，每次 `/chat` 通过 `goal` 字段发送；Agent 不建立额外用户配置表。

**session_id 管理**：
- 前端模块每个页面生命周期生成一个 `conversationId`，不持久化；刷新后可见聊天历史与短期 AgentState 同时从新会话开始。
- 每个页面/题目的 AgentState session id 由 `ALGOCOACH_SESSION_ID` 前缀和 `[conversationId, platform, problemId]` 的 SHA-256 派生；IDLE/PREP/REVIEW 共享同一训练对话，当前模式每轮更新到系统提示。FOCUS 在模型和记忆调用前直接返回，不污染对话状态。
- `ALGOCOACH_SESSION_ID` 仅作为本地部署的命名空间前缀。ReMe 仍共享本地 workspace，自动检索可跨题召回长期记忆。
- 兼容旧客户端：没有 `conversationId`，但同时提供 `platform` 与 `problemId` 时按题目派生 session；否则沿用配置前缀。同一题目的不同训练阶段仍保持连续上下文。

---

### 2.2 情节记忆（Episodic Memory）

**SQLite 表：`episodic`**

```sql
CREATE TABLE episodic (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id      TEXT    NOT NULL,          -- LeetCode titleSlug
    platform        TEXT    NOT NULL DEFAULT 'LEETCODE',
    status          TEXT    NOT NULL,          -- ACCEPTED / WRONG_ANSWER / ...
    lang            TEXT    NOT NULL,          -- rust / cpp / python3
    duration_sec    INTEGER NOT NULL DEFAULT 0,-- FOCUS 阶段耗时
    topics          TEXT    NOT NULL,          -- JSON 数组，如 ["DP","背包"]
    sticking_points TEXT    NOT NULL,          -- JSON 数组，agent 在 REVIEW 阶段写入
    edit_trail_len  INTEGER DEFAULT 0,         -- FOCUS 阶段键击数（粗略卡点指标）
    created_at      TEXT    NOT NULL           -- ISO 8601
);

CREATE INDEX idx_episodic_problem ON episodic(problem_id);
CREATE INDEX idx_episodic_created ON episodic(created_at);
```

**写入时机**：

| 时机 | 触发方 | 写入字段 |
|------|--------|---------|
| 提交到 LeetCode 并拿到结果 | Java gateway → HTTP POST `/agent/episodic` | problem_id, status, lang, duration_sec, topics |
| REVIEW 阶段 agent 调用 `record_sticking_points` tool | Python coach.py | sticking_points, pattern_key |

**查询模式**：
```python
# 最近 N 题（用于注入 system prompt）
SELECT * FROM episodic ORDER BY id DESC LIMIT 10;

# 某题型的历史成功率
SELECT status, COUNT(*) FROM episodic
WHERE topics LIKE '%DP%' GROUP BY status;

# 平均用时趋势（判断是否进步）
SELECT DATE(created_at), AVG(duration_sec)
FROM episodic WHERE status='ACCEPTED'
GROUP BY DATE(created_at) ORDER BY 1;
```

---

### 2.3 语义记忆（Semantic Memory）

#### 2.3.1 ELO mastery 评分

**SQLite 表：`semantic`**

```sql
CREATE TABLE semantic (
    topic           TEXT    PRIMARY KEY,       -- "BFS" / "DP背包" / "滑动窗口"
    mastery         REAL    NOT NULL DEFAULT 0.5,
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_seen       TEXT    NOT NULL DEFAULT '',
    weak_subtopics  TEXT    NOT NULL DEFAULT '[]',  -- JSON
    related_topics  TEXT    NOT NULL DEFAULT '[]'   -- JSON
);
```

**ELO 更新算法**：

```python
DELTA_ACCEPT = +0.05   # 每次 AC 增长
DELTA_FAIL   = -0.08   # 每次失败下降（失败代价更大，符合认知科学）
CLAMP        = (0.0, 1.0)

new_mastery = clamp(old_mastery + delta, *CLAMP)
```

参数设计依据：
- 失败的惩罚（0.08）大于成功奖励（0.05），避免"过度乐观"。
- 20 次 AC 后 mastery ≈ 1.0（从 0.5 起算），符合熟练周期预期。
- 10 次连续失败可将 mastery 从 0.5 降至 ~0.0，触发强化推送。

**未来调参方向**：
- 引入题目难度权重：HARD 题 AC 给 +0.10，EASY 题 AC 给 +0.03。
- 引入时间衰减：超过 30 天未练，mastery 每天 -0.005（遗忘曲线）。

#### 2.3.2 知识图谱关系表

```sql
CREATE TABLE semantic_relation (
    from_topic  TEXT NOT NULL,
    to_topic    TEXT NOT NULL,
    weight      REAL NOT NULL DEFAULT 1.0,  -- 依赖强度
    rel_type    TEXT NOT NULL DEFAULT 'PREREQ',
    -- PREREQ: from 是 to 的前置知识
    -- RELATED: 同类题型
    -- VARIANT: 变体题
    PRIMARY KEY (from_topic, to_topic)
);

-- 示例数据
INSERT INTO semantic_relation VALUES ('BFS', '最短路径', 0.9, 'PREREQ');
INSERT INTO semantic_relation VALUES ('DP', 'DP背包', 1.0, 'PREREQ');
INSERT INTO semantic_relation VALUES ('图论', 'BFS', 0.8, 'PREREQ');
INSERT INTO semantic_relation VALUES ('图论', 'DFS', 0.8, 'PREREQ');
INSERT INTO semantic_relation VALUES ('滑动窗口', '双指针', 0.6, 'RELATED');
```

**推题策略利用关系图**：
1. 找到 mastery 最低的节点（薄弱点）。
2. 沿 `PREREQ` 边向上找前置知识，若前置 mastery 也低，优先补前置。
3. 推完前置后，沿原路返回推薄弱点。

#### 2.3.3 chromadb 向量化方案（P1 已实现）

实现位于 `backend/agent/app/memory/vector_store.py`，使用锁定版本 `chromadb==1.5.9`，持久化目录由 `CHROMA_PATH` 指定（默认 `../../data/chroma`，容器内 `/data/chroma`）。所有数据只写本机：不调用云 embedding API，不上传题目或用户卡点；Chroma 匿名遥测通过 `anonymized_telemetry=False` 关闭。

```python
# 三个独立 collection，避免跨类型召回噪声
collections = {
    "problem_content": "题目题干（用于相似题检索）",      # ✅ P1
    "topic_explanation": "知识点解释文本（动画 props 参考）",  # ✅ P1 API
    "error_description": "用户错误描述（识别重复错误）",   # ✅ P1
}
# solution_comment 仍为 V2：REVIEW 追问尚无明确数据来源，不创建 collection。

# 幂等 upsert：id 是幂等键（题目用 problem_id，文本类用内容哈希）
await vector_store.index_problem(problem_id, title, content, topics)
await vector_store.index_error_descriptions(problem_id, sticking_points)

# 查询示例：给定当前题目文本，找 Top-5 相似历史题
def find_similar_problems(problem_text: str, top_k: int = 5):
    emb = embed(problem_text)
    return chroma.query(collection="problem_content", query_embeddings=[emb], n_results=top_k)
```

- **embedding**：默认使用 Chroma 本地 ONNX `all-MiniLM-L6-v2`（384 维）。模型延迟到首次索引/查询才初始化；第一次使用会把约 80 MB 模型下载到本机缓存（Compose 中为持久化的 `/data/.cache/chroma`），之后可离线使用。测试注入确定性 fake embedding，不下载模型。
- **返回边界**：query 默认 `top_k=5`、上限 10，document 截断到 500 字符；coach 的 `get_similar_problems` 进一步限制为最多 5 条。
- **metadata**：`id` / `problem_id` / `title` / `topic` / `platform` / `created_at`（题目另有 `difficulty`），可用于等值过滤。
- **降级**：chromadb 缺失或本地目录损坏时，相似题 tool 返回错误而不是让对话失败；索引失败只记日志。
- **迁移**：同一 collection 不能混用不同维度 embedding；更换模型后需清空并重建 `CHROMA_PATH`，当前无自动迁移。

---

### 2.4 程序记忆（Procedural Memory）

**SQLite 表：`procedural`**

```sql
CREATE TABLE procedural (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_key  TEXT    NOT NULL UNIQUE,
    description  TEXT    NOT NULL,
    frequency    INTEGER NOT NULL DEFAULT 1,
    last_seen    TEXT    NOT NULL DEFAULT ''
);
```

**pattern_key 命名规范**：
```
{domain}_{error_type}

示例：
  dp_state_definition_wrong     -- DP 状态定义错误
  graph_cycle_not_handled       -- 图算法未处理环
  array_off_by_one              -- 数组越界（差一错误）
  recursion_base_case_missing   -- 递归缺少 base case
  overflow_not_checked          -- 整数溢出未处理
```

**agent 自动识别流程**：
1. REVIEW 阶段，agent 拿到提交结果（WRONG_ANSWER / TLE / RE）。
2. Claude 分析错误信息 + 用户代码，调用 `record_sticking_points` tool。
3. Tool handler 中：`upsert_pattern(key, description)`，frequency+1。
4. 下次生成 `build_context_snapshot()` 时，`top_patterns(5)` 注入 system prompt。

---

## 3. 记忆更新时序图

```
用户点击「提交」
        │
        ▼
  前端 POST /api/submit
        │
        ▼
Java Gateway ──► LeetCode GraphQL submitSolution
        │               │
        │         轮询 checkSubmission
        │               │ (status: PENDING → ACCEPTED/WA/...)
        ▼               ▼
  拿到 Submission 结果
        │
        ├── 写 SubmissionRecord (gateway SQLite)
        │
        └── POST /agent/episodic  ◄── 触发 agent 更新记忆
                    │
                    ▼
         memory.record_attempt()
                    │
                    ├── 写 EpisodicRecord
                    │
                    └── 更新 SemanticNode mastery
                              │
                              ▼
                    前端 mode → REVIEW
                              │
                              ▼
                    agent.chat(mode=REVIEW)
                              │
                    Claude 分析代码 + 结果
                              │
                    调用 record_sticking_points
                              │
                              ├── 更新 EpisodicRecord.sticking_points
                              └── upsert ProceduralPattern
```

---

## 4. `build_context_snapshot()` 格式设计

**目标**：在每次 Claude 调用前，将最相关的记忆压缩注入 system prompt，控制在 ~500 tokens 内。

**输出 JSON schema**：

```json
{
  "weak_topics": [
    {"topic": "DP背包", "mastery": 0.32, "attempts": 7},
    {"topic": "图论最短路", "mastery": 0.41, "attempts": 3}
  ],
  "recent_problems": [
    {
      "problem_id": "coin-change",
      "status": "WRONG_ANSWER",
      "topics": ["DP"],
      "sticking_points": ["初始化 dp[0]=0 而非 Infinity"],
      "duration_sec": 1823,
      "created_at": "2026-11-12T10:30:00Z"
    }
  ],
  "common_mistakes": [
    {"key": "dp_state_definition_wrong", "description": "DP 状态定义时混淆了「最优」和「合法」", "frequency": 5}
  ]
}
```

**注入 system prompt 片段**：
```
用户记忆快照（请根据此个性化你的回复）：
- 薄弱点：DP背包(32%)、图论最短路(41%)
- 最近错误：coin-change 答错，卡点：dp[0] 初始化错误
- 常见问题：DP 状态定义时混淆「最优」和「合法」（出现5次）
```

**Token 预算控制**：
- `weak_topics`：最多 5 条，每条约 10 tokens → 50 tokens
- `recent_problems`：最多 5 条，每条约 50 tokens → 250 tokens
- `common_mistakes`：最多 3 条，每条约 20 tokens → 60 tokens
- 总计 ~360 tokens，安全边际充足。

---

## 5. 间隔复习算法（SM-2 简化版）

`next_review_interval_days()` 已在 `backend/agent/app/memory/memory_service.py` 实现，公式与下方一致（`attempts` 保留在签名中，当前不参与计算）：

```python
def next_review_interval_days(mastery: float, attempts: int, last_interval: int) -> int:
    """
    结合 mastery score 和 SM-2 间隔倍增，决定下次复习时间。

    mastery < 0.4  → 强化模式：1~3 天内再练
    mastery 0.4~0.7 → 正常模式：SM-2 倍增
    mastery > 0.7  → 维持模式：14~30 天
    """
    if mastery < 0.4:
        return max(1, last_interval // 2)      # 间隔减半，加强巩固
    elif mastery > 0.7:
        return min(30, last_interval * 2)      # 间隔翻倍，减少复习频率
    else:
        # SM-2 核心：EF 因子从 mastery 线性映射
        ef = 1.3 + mastery * 1.3               # EF ∈ [1.3, 2.6]
        return round(last_interval * ef)
```

**持久化：`review_schedule`（P1）**

episodic 是“每次尝试一行”，没有 `next_review` 字段；直接给 episodic 加列会让同一道题产生多条互不一致的到期状态。因此新增按题目去重的 `review_schedule` 表（`problem_id` 主键，`due_at, interval_days, mastery, attempts, topics, source_episode_id, notified_on, last_notified_at, updated_at`）。

**既有记录的初始 due date 推导：**

1. 从 `episodic` 中挑“最新一条有资格”的记录：`status != ACCEPTED`（错题/超时等）或 `sticking_points` 非空；普通 `REVIEWED` 且无卡点不算。
2. 取该题 topics 中最弱 semantic 节点的 mastery/attempts；没有记录时用 `0.5 / 1`。
3. 令 `last_interval = 1`，按上面的公式得到初始间隔（从 1 天基数出发，初始为 1 或 2 天）。
4. `due_at = episode.created_at + interval`。旧记录因此立即到期，新记录等待一个间隔；seed 只插入缺失的 problem，可重复执行。
5. 新提交写入 episodic 后，若属于错题/卡点，会 upsert 对应 schedule。

**Cron 推送逻辑**：

1. 每天 20:00 查询 `review_schedule` 中 `due_at <= now` 且当天未通知的题目。
2. 按当前 semantic mastery 升序，优先推最弱的；`mastery` 在查询时重新计算，避免快照过期。
3. 每天**跨多次运行合计**最多 3 道（用 `review:<本地日期>:<problem_id>` 去重键计数），避免压力过大，也避免重试/重启重复推送。
4. 推送成功后按公式重排 `due_at`；通知节奏下限为 2 天，避免同一题连续每天出现。

---

## 6. 记忆容量管理

### Episodic 归档

归档实现为 `MemoryService.archive_old_episodes()`，按 90 天界限把 `episodic` 行复制到 `episodic_archive`，并在**同一个 SQLAlchemy 事务**中删除热表记录；复制保留原 `id` 作为归档主键，因此中断后重跑不会重复复制，也不会丢数据。

```sql
-- 语义等价于：
INSERT INTO episodic_archive SELECT *, :archived_at FROM episodic
WHERE created_at < :cutoff;
DELETE FROM episodic WHERE created_at < :cutoff;
```

**调度策略说明（P1/P2）：**

- `docs/backend-agent.md` §3.4 的“记忆巩固”任务每天 03:00 运行，其中包含 90 天归档检查；相比“每月 1 日”更及时，且因为是幂等事务，每天执行不会重复归档。
- “每月归档”仍是对外的策略描述：归档边界是 90 天，日常 03:00 检查只是执行方式；主表目标仍是 ≤ 10,000 行。
- 03:00 任务**不做** mastery 权重衰减。文档中 0.005/天只是未来调参方向，本轮未获授权，不应据此修改 mastery。
- 推荐历史存于 `recommendation_log`，**没有**外键指向 episodic：归档/删除 episodic 不会删除或重复生成推荐记录。7 天评估窗口整体落在 90 天归档边界内，正常评估不会丢失证据；延迟评估时弃做判断也会读取 `episodic_archive`（详见 §9）。

### 向量库 Compaction（V2）

```python
# 每周压缩一次向量库
# 对同一题目的多次 embedding，只保留最新一条
chroma.delete(where={"created_at": {"$lt": week_ago}})
```

---

## 7. Soul（用户画像）完整字段设计

```sql
CREATE TABLE user_soul (
    id                  TEXT PRIMARY KEY DEFAULT 'default',

    -- 基础偏好
    preferred_lang      TEXT DEFAULT 'rust',       -- rust / cpp / python3
    ui_theme            TEXT DEFAULT 'dark',

    -- 学习目标
    goals               TEXT DEFAULT '[]',          -- JSON: ["interview", "contest", "improve"]
    target_companies    TEXT DEFAULT '[]',          -- JSON: ["字节", "阿里", ...]
    target_contest      TEXT DEFAULT '',            -- "蓝桥杯" / "ACM" / ""

    -- 能力画像（由 agent 更新）
    strong_topics       TEXT DEFAULT '[]',          -- JSON
    weak_topics         TEXT DEFAULT '[]',          -- JSON
    avg_solve_time_sec  INTEGER DEFAULT 0,
    total_problems      INTEGER DEFAULT 0,
    acceptance_rate     REAL DEFAULT 0.0,

    -- 学习习惯
    preferred_time      TEXT DEFAULT '',            -- "morning" / "night" / ""
    daily_goal_problems INTEGER DEFAULT 3,
    focus_duration_pref INTEGER DEFAULT 45,         -- 分钟

    -- 常见错误（冗余缓存自 procedural，便于快速读取）
    top_mistakes        TEXT DEFAULT '[]',          -- JSON: [{"key":..., "freq":...}]

    updated_at          TEXT NOT NULL DEFAULT ''
);
```

---

## 8. 向量记忆 embedding 策略（P1 已部分落地）

| Collection | 文本来源 | 用途 | Embedding 时机 | 状态 |
|-----------|---------|------|--------------|------|
| `problem_content` | 题目翻译后的中文描述 + 示例 | 相似题检索 | 题目首次加载时（`fetch_problem_meta`） | ✅ P1 |
| `topic_explanation` | agent 生成的知识点解释文本 | 动画 props 生成参考 | PREP 阶段 | ✅ P1 API，暂无调用方 |
| `error_description` | 用户 sticking_points 自然语言 | 识别重复错误模式 | REVIEW 阶段后（`record_sticking_points`） | ✅ P1 |
| `solution_comment` | 用户在 REVIEW 阶段的追问 | 个性化学习路径分析 | 对话结束后异步处理 | ⏳ V2（无数据来源） |

每类 collection 独立命名空间，避免跨类型召回噪声。默认本地 ONNX embedding、`CHROMA_PATH` 持久化与首次加载行为见 §2.3.3。

---

## 9. 自我改进：推荐记录、7 天回测与月度复盘（P2）

实现位于 `backend/agent/app/agent/self_improve.py`，数据表在 `backend/agent/app/memory/db.py`。这是**人工分析型 MVP**：只记录推荐效果并生成可读汇总，不自动修改 Soul、prompt、推荐权重或配置，也没有正式 UI/通知。

### 9.1 数据模型：`recommendation_log`

```sql
CREATE TABLE recommendation_log (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy          TEXT    NOT NULL,        -- due_review / similar_problem / topic_only
    topic             TEXT    NOT NULL,        -- 推荐针对的薄弱 topic
    problem_id        TEXT,                    -- 确认的 slug；topic-only 推荐为 NULL
    mastery_before    REAL    NOT NULL,        -- 推荐时的 mastery 基线
    created_at        TEXT    NOT NULL,        -- naive UTC
    evaluation_due_at TEXT    NOT NULL,        -- created_at + 7 天
    evaluated_at      TEXT,                    -- 实际评分时间；未评分 NULL
    score             INTEGER,                 -- -1 / 0 / 1；未评分 NULL
    outcome           TEXT,                    -- improved / neutral / declined / abandoned
    mastery_after     REAL                     -- 按 due 窗口重建的评分快照；旧版已评行 NULL
);
```

- 新库由 `create_all` 建表；若存在早期草案表，`init_db()` 用可重跑的 `ALTER TABLE ADD COLUMN` 补 `strategy` / `evaluation_due_at` / `outcome` / `mastery_after`，旧行新列保持 `NULL`，不重写既有行。
- 历史推荐是 append-only 事实：评分只更新 `evaluated_at/score/outcome/mastery_after`，不删除行。

### 9.2 推荐来源：`suggest_next_problem`

1. 默认取 `weak_topics(threshold=0.6)` 最弱的最多 3 个 topic；也接受显式 `topic`。
2. 候选优先级：`review_schedule` 中已到期的题目 → 本地 `problem_content` 向量库中已索引的相似题 → topic-only。
3. 只使用已确认的 LeetCode slug，**不杜撰题目**；向量库不可用时降级为 topic-only（`problem_id=NULL`）。
4. 排除当前正在做的题；每条实际推荐都先写 `recommendation_log` 再返回。`limit` clamp 到 1–3，不调用新外部模型/上游 API。

### 9.3 评分语义（固定 7 天，按 due 时刻重建 mastery）

`evaluation_due_at = created_at + 7 天`，数据库时间为 naive UTC；调度时区只决定任务何时触发，不改变窗口长度。评分**不读取 live semantic mastery**，避免 worker 停机后延迟到第 8–10 天才评估时把窗口后的练习算进来。

重建步骤（结果写入 `mastery_after` 供审计）：

1. 基线 = `recommendation_log.mastery_before`。
2. 只收集 `created_at <= episodic.created_at <= evaluation_due_at` 且 `topics` 包含该 topic 的 `EpisodicRecord` 与 `EpisodicArchive`。
3. 按 `(created_at, id)` 顺序重放现有 ELO 规则：`ACCEPTED` +0.05，其余状态 -0.08，每步 clamp 到 `[0,1]`。
4. 窗口内无任何事件 → `-1` abandoned（`mastery_after = mastery_before`）。
5. 有事件时按重建 delta 判定：≥ +0.10 → `+1` improved；≤ -0.05 → `-1` declined；其他 → `0` neutral。

| 条件（窗口到期后） | score | outcome |
|--------------------|-------|---------|
| `now < evaluation_due_at` | 不评分（保持 NULL） | — |
| 窗口内无该 topic 事件 | -1 | abandoned |
| 重建 mastery − 基线 ≥ 0.10 | +1 | improved |
| 基线 − 重建 mastery ≥ 0.05 | -1 | declined |
| 有事件但重建变化未达阈值 | 0 | neutral |

- 比较带 `1e-9` 浮点容差，保证恰好 +0.10 / -0.05 按文档判定。
- 窗口之后的事件、评估时的 live mastery 都不参与评分；调度延迟只影响评分时间，不影响窗口。
- `memory.get_mastery(topic)` 只用于推荐时捕获基线；未知 topic 按项目现有语义返回 `0.5`（与 `SemanticNode.mastery` 默认值、`_weakest_snapshot()` 回退一致）。
- 评分是“重建 → `UPDATE ... WHERE evaluated_at IS NULL`”的条件写入：并发/重试最多产生一个分数；已评记录重试返回原分数且不改 `evaluated_at`/`mastery_after`。`evaluate_due_recommendations()` 只处理 `evaluated_at IS NULL` 的行，单行失败不影响整批。

### 9.4 与 90 天归档的关系

- 7 天评估窗口远小于 90 天归档边界，正常评估不会因 03:00 归档而丢失证据。
- `recommendation_log` 无外键依赖 episodic，归档只移动/删除 episodic，不影响历史推荐行，也不会触发“重复评估”。
- 窗口重建同时读取 `episodic` 与 `episodic_archive`；服务停机导致评估拖到归档之后时，仍只会重放 `[created_at, created_at + 7 天]` 内的冷/热事件，窗口外数据不参与。
- 若 episodic 被归档之外的途径硬删除，该次评估只能按“无活动”处理；这是 MVP 的已知限制。
- 事件按 episode 的 `topics` 匹配。`record_sticking_points` 目前写入 `topics=[]` 的 REVIEWED episode，因此只有复盘、没有 gateway 做题提交记录时可能被判为无活动；正常提交（带 topics）不受影响。

### 9.5 月度复盘

`monthly_strategy_review(now=...)`：

- 窗口为 `now - 30 天` 至 `now`（滚动 30 天，按 `evaluated_at` 归属），**只统计 `score` 非空的已评记录**。
- 每个 strategy 输出 `samples`（分母）、`improved/neutral/declined/abandoned`、`success_rate = improved / samples`；`overall` 同样带样本数。
- 生成确定性中文建议：样本 < 3 的标准明确写“暂不做判断”，其他按成功率给出“维持/复核”建议，并显示分子/分母。
- 只写日志并返回结构；`auto_tuning_applied` 恒为 `False`，不写通知、不改配置。读取 `logs` 或接入 Claude 重新生成 Soul 权重属于后续人工步骤，本轮未实现。

### 9.6 调度

| job id | 触发 | 行为 |
|--------|------|------|
| `self_improve_evaluation` | 每天 04:00（`ALGOCOACH_TIMEZONE`） | 评估 `evaluation_due_at <= now` 且未评分的推荐 |
| `self_improve_monthly_review` | 每月 1 日 04:30 | 生成 30 天 strategy 汇总并写日志 |

两个 job 与既有 cron 共用单例 `AsyncIOScheduler`、固定 id、`replace_existing=True`、`coalesce=True`、`max_instances=1`；`ALGOCOACH_CRONS_ENABLED=false` 会一并关闭。

### 9.7 测试

`backend/agent/tests/test_self_improve.py` 使用隔离临时 SQLite 与确定性 fake 向量库，覆盖迁移重跑（含 `mastery_after` 旧行 NULL）、未知 mastery 默认值、成功/失败/中性/弃做/窗口未到、阈值边界、按时间/id 重放、延迟到第 10 天评估时第 8–9 天活动与 live mastery 均不影响分数、due 边界事件、并发与重试幂等、批量重跑、topic-only 与具体题推荐、月度样本分母、归档行参与窗口重建、调度器重复注册/时区与 cron 入口；不调用真实 LLM、HTTP 或 Chroma embedding 模型。
