# AlgoCoach 前端模块详细计划

> 技术栈：React 18 + Vite + TypeScript + TailwindCSS + Zustand + Monaco Editor + Remotion Player
> 当前实现：左侧导航 + 三栏刷题工作区；Agent 请求统一经 Java Gateway 的 `/api/agent/*`。

---

## 1. 模块职责和边界

### 职责
- 渲染三栏工作区 UI（题目描述 / 代码编辑器 / AI 对话）
- 维护 `AgentMode` 状态机，强制执行 FOCUS 模式下的 AI 静默约束
- 通过 Java 网关 (`/api/*`) 拉取题目、提交代码、管理 Cookie 认证
- 通过 Java 网关 (`/api/agent/*`) 与 Python Agent 对话、请求动画
- 渲染 Remotion 动画，轮询渲染状态自动播放
- 双主题（浅色/深色）切换

### 边界（前端不做的事）
- 不直接调用 LeetCode GraphQL（由 Java 网关代理）
- 不直接调用 Claude API（由 Python agent 服务代理）
- 不在 FOCUS 模式下显示任何 AI 相关 UI（包括补全、提示、chat 输入框）
- 不持久化代码内容到 localStorage；后端 episodic 只保存判题状态、题目标签与用时，不保存源码
- 不在前端存储任何 Cookie 明文（Cookie 只存在 Java 网关的 SQLite）

---

## 2. 目录结构

```
frontend/
├── index.html                      # Vite 入口，挂载 #root
├── package.json
├── vite.config.ts                  # Vite 配置，proxy /api → :8080
├── tailwind.config.ts              # 主题 token（靛蓝 accent，双主题）
├── tsconfig.json                    # 含 @/* path alias
├── postcss.config.js
└── src/
    ├── main.tsx                    # React 挂载，BrowserRouter 包裹
    ├── index.css                   # Tailwind base + 全局组件类
    ├── types/
    │   └── index.ts                # 领域类型（Problem, Submission, ChatMessage...）
    ├── stores/
    │   └── useAppStore.ts          # Zustand 全局状态（mode, code, messages, animations...）
    ├── services/
    │   ├── leetcodeService.ts      # axios → /api/* (Java 网关)
    │   ├── trainingTopics.ts       # 专项定义（LeetCode topic slug）
    │   ├── acwingService.ts        # axios → /api/acwing/*（需 Cookie，专项=标签搜索）
    │   ├── hduService.ts           # axios → /api/hdu/*（按卷分页）
    │   ├── platformCookieService.ts # /api/platforms/* Cookie 状态与保存
    │   ├── languages.ts            # 语言键、下拉标签、Monaco 映射
    │   └── agentService.ts         # axios → /api/agent/* (Gateway → Python agent)
    ├── hooks/
    │   └── usePollAnimation.ts     # 轮询动画渲染状态
    ├── components/
    │   ├── Layout/
    │   │   ├── AppShell.tsx        # 顶层布局：Sidebar + Header + 三栏
    │   │   ├── Sidebar.tsx         # Qwen 风格可折叠左侧导航
    │   │   └── Header.tsx          # 题目标题、mode 徽章、运行/提交按钮
    │   ├── Editor/
    │   │   ├── EditorPanel.tsx     # Monaco 编辑器容器 + PREP 蒙层
    │   │   ├── TestCasePanel.tsx   # 底部测试用例 tab
    │   │   └── SubmissionResult.tsx # 提交后结果展示
    │   ├── Chat/
    │   │   ├── ChatPanel.tsx       # 对话面板（FOCUS 锁定）
    │   │   └── ChatMessage.tsx     # 单条消息（支持 Markdown + 代码高亮）
    │   ├── Problem/
    │   │   └── ProblemPanel.tsx    # 左栏题目描述渲染
    │   ├── Animation/
    │   │   └── AnimationCard.tsx   # Remotion 动画卡片（轮询 + 播放）
    │   └── Common/
    │       └── Badge.tsx           # 难度徽章
    └── pages/
        ├── CookieSetupPage.tsx     # LeetCode Cookie 配置页
        ├── SettingsPage.tsx        # 语言/目标/主题/Provider/导出设置
        ├── ProgressPage.tsx        # 训练进度
        ├── KnowledgeGraphPage.tsx  # 掌握关系图
        └── graphLayout.ts          # 图布局算法

题目列表视图内嵌在 `ProblemPanel`；工作区和其他路径由 `AppShell` 管理，没有独立的 `ProblemListPage` / `WorkspacePage` 文件。知识图谱和进度页面已接入本地 Agent profile。
```

---

## 3. 已有组件详细规格

### 3.1 AppShell.tsx

**职责**：顶层布局容器，组合 Sidebar + Header + 三栏工作区。

**Props**：无（从 store 读取所有状态）

**内部逻辑**：
- `useEffect` 监听 `theme` 变化，切换 `<html>` 的 `dark` class
- 当 `mode === 'FOCUS'` 时，在顶部渲染 `focus-mode-bar`（红色细条 + 脉冲动画）
- 三栏宽度：题目栏 `var(--problem-w)=420px`（固定）、编辑器栏 `flex-1`（自适应）、对话栏 `360px`（固定）

**已实现**：
- `<React.Suspense>` 包裹 Monaco 编辑器，实现懒加载
- React Router 按 URL 切换工作区、进度、知识图谱和设置页面

### 3.2 Sidebar.tsx

**职责**：Qwen 风格可折叠左侧 icon 导航。

**Props**：无

**内部状态**：
- 从 store 读取 `sidebarExpanded`、`toggleSidebar`、`mode`
- `NAV_ITEMS` 常量定义四个导航项及其目标路径：`/workspace` / `/progress` / `/knowledge` / `/settings`

**关键逻辑**：
- 折叠时宽 `56px`，展开时 `220px`，通过 `transition-all duration-200` 平滑过渡
- 底部显示 mode 指示圆点，颜色按 mode 变化：FOCUS=红脉冲 / REVIEW=绿 / PREP=靛蓝 / IDLE=灰
- 展开/折叠按钮固定在底部，图标用 `ChevronLeft/Right`

**已实现**：
- `NAV_ITEMS` 使用 `/workspace`、`/progress`、`/knowledge`、`/settings` 路径；`NavLink` 负责切换和当前项高亮。
- `/` 默认重定向至 `/workspace`，未知路径也回到工作区。
- `/progress` 与 `/knowledge` 使用 Agent 本地 profile 数据；`/settings` 提供偏好设置，`/settings/platforms` 是 LeetCode / AcWing / 杭电 HDU 三平台登录态的统一入口。
- AppShell 启动时只检查 Java Gateway；网关不可用时显示重试入口。LeetCode 未登录不会阻挡工作区，题库请求失败时在题目面板内显示平台错误并提供登录设置入口。

### 3.3 Header.tsx

**职责**：顶栏，显示题目标题、难度徽章、语言选择、mode 徽章、运行/提交按钮、主题切换。

**Props**：无

**内部逻辑**：
- 语言选择器 `select`，值 `rust` / `cpp` / `python3` / `typescript` / `golang` / `java`，写入 store 的 `lang`
- `onRun` 调用 `leetcodeService.runTests()`，提交当前题目、代码、语言和测试输入；运行结果或失败信息显示在测试区。
- `onSubmit` 调用 `leetcodeService.submit()`，提交累计 FOCUS 用时；返回终态后保存结果并切换 REVIEW。
- `mode === 'FOCUS'` 时 mode 徽章显示红色 `Lock` 图标
- 运行/提交仅在 FOCUS 模式可用；请求期间显示 loading 并阻止重复提交。REVIEW 可继续做题，重试阶段的 FOCUS 时间会累计。
- Gateway 保存提交后将判题事实、用时和题目标签写入 Agent episodic/semantic 记忆；前端随后发送不含代码的 `review` 阶段消息，启动 OI/xCPC 结构化复盘。

**当前限制**：REVIEW 的 Agent 网络调用没有 SSE 流式呈现；当前是整条回复返回后一次展示。

### 3.4 EditorPanel.tsx

**职责**：Monaco 代码编辑器容器 + 底部测试用例/提交结果切换。

**Props**：无

**关键逻辑**：
- `MONACO_LANGUAGES`（`services/languages.ts`）：前端 lang → Monaco language id（`rust→rust`, `cpp→cpp`, `python3→python`, `typescript→typescript`, `golang→go`, `java→java`）
- `isEditable = mode === 'FOCUS' || mode === 'REVIEW'`：PREP/IDLE 下编辑器只读
- PREP 模式下显示半透明蒙层 + "开始做题" 按钮，点击调用 `enterFocus()`
- Monaco `options.quickSuggestions` 绑定到 `isEditable`：FOCUS 下只启用 Monaco 本地语言建议，不接入 AI 补全
- 选题后使用当前语言对应的 LeetCode starter code；切换语言只更新 Monaco 语言标识，不覆盖用户编辑内容。

**Monaco 配置要点**：
```typescript
{
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  minimap: { enabled: false },
  readOnly: !isEditable,
  quickSuggestions: isEditable,        // FOCUS 下只开 Monaco 本地建议
  suggestOnTriggerCharacters: true,
  tabSize: 4,
  padding: { top: 12, bottom: 12 },
}
```

**当前边界**：
- LeetCode Run 不会提供测试 case 的期望输出时，结果区域按实际回包显示，不推算缺失字段。

### 3.5 ChatPanel.tsx

**职责**：右栏 AI 对话区，FOCUS 模式下完全锁定。

**Props**：无

**内部状态**：
- `input: string`（本地，不进 store）
- `loading: boolean`
- 从 store 读 `mode`、`messages`、`addMessage`、`activeAnimation`

**关键逻辑**：
- `isFocus = mode === 'FOCUS'`，为 true 时：
  - 输入框替换为锁定提示条（红色边框 + Lock 图标 + "专注解题中，AI 已静默"）
  - 已有消息仍可见（用户可回顾 PREP 阶段的对话），但不可发送
- 发送：调用 `agentService.chat(content, { mode, problemId })`，返回 `{ content, animationId }`
- Submit 结束后自动以 `trainingPhase: 'review'` 发送判题状态、通过数、用时和题目标签；提交代码不随复盘请求发送。
- 消息追加：用户消息立即追加，agent 消息等 API 返回后追加
- `loading` 时显示三点跳动动画 + "思考中…"
- `activeAnimation` 存在时在消息流末尾渲染 `<AnimationCard>`

**当前行为**：对话按题目保存在进程内 Zustand 状态，切换题目后可返回原对话；刷新页面会清空，避免把用户粘贴的代码写入浏览器存储。Submit 结束后发送不含代码的判题摘要启动赛后复盘；动画生成期间加入 system 状态消息。尚未实现 SSE。

### 3.6 ChatMessage.tsx

**职责**：单条消息渲染，agent 消息支持 Markdown + 代码高亮。

**Props**：`{ message: ChatMessage }`

**关键逻辑**：
- `role === 'system'`：居中灰色小字
- `role === 'user'`：右对齐蓝色气泡
- `role === 'agent'`：左对齐灰色气泡 + AI 头像圆点，用 `ReactMarkdown` 渲染
- 代码块用 `react-syntax-highlighter` 的 `Prism` 风格，主题跟随 `useAppStore.theme`

**当前行为**：代码块提供复制按钮；超过 200 行的 Agent 回复默认折叠，可展开。

### 3.7 ProblemPanel.tsx

**职责**：左栏题目描述渲染。

**Props**：无（从 store 读 `activeProblem`、`mode`）

**关键逻辑**：
- 尚未选题时从 Gateway 拉取 LeetCode 题目列表；选择题目后加载详情、题干、标签、样例与 starter code。FOCUS 期间锁定题目切换。
- 题库按专项训练组织：`services/trainingTopics.ts` 的 `TRAINING_TOPICS` 把每个 LeetCode 专项定义为一组官方 topic slug（专项内 OR），选专项后把 slug 以逗号拼进 `tag` 参数、难度作为 `difficulty` 参数，由 Gateway 在 LeetCode v2 `filters` 里生效；`共 N 题` 来自上游 `totalLength`。
- 平台选择：LeetCode / AcWing / 杭电 HDU。LeetCode 保留专项+难度筛选；AcWing 专项走站点的标签搜索（`ACWING_TOPICS`，如 `模拟`、`二分`、`动态规划`），打开题目时附六语言 starter 模板；HDU 无标签/难度，仅浏览题面。运行/提交仍只对 LeetCode 可用。
- 题名/slug 搜索只在当前页内过滤，不改变服务端筛选。
- 无题目时显示空状态占位（Play 图标 + 引导文字）
- 有题目时：难度徽章 + 每日一题标签 + topic 标签 + HTML 内容（`dangerouslySetInnerHTML`）
- PREP 模式底部显示"开始做题"CTA，点击 `enterFocus()`

**当前行为**：题干经过 DOMPurify 白名单净化后再渲染。收藏和返回顶部快捷按钮不在当前训练闭环内。

### 3.8 AnimationCard.tsx

**职责**：在对话流中嵌入 Remotion 动画卡片。

**Props**：`{ job: AnimationJob }`

**状态渲染**：
- `QUEUED` / `RENDERING`：骨架屏 + 旋转 Loader + "正在生成动画：{title}"
- `READY` + `videoUrl`：`<video>` 自动播放 + 循环 + 控制条
- `FAILED`：显示通用错误并提供重试操作

轮询由 `usePollAnimation` hook 按 1.5 秒间隔执行；卸载或切换题目时清理定时器。

### 3.9 CookieSetupPage.tsx

**职责**：用户访问 `/settings/cookie` 时配置 LeetCode Cookie；工作区启动不依赖该 Cookie。

**Props**：`{ onDone: () => void }`

**内部状态**：
- `session: string` / `csrf: string` / `loading: boolean` / `error: string`

**关键逻辑**：
- 4 步引导（打开 leetcode.cn → F12 → 找 Cookie → 粘贴）
- 两个字段输入，校验非空后调用 `leetcodeService.setCookie(session, csrf)`
- 成功后调用 `onDone()` 回调，父组件切换到工作区

保存后调用需要用户身份的 Gateway 题目端点验证 Cookie；LeetCode 返回 401 时，前端自动重新打开 Cookie 设置页。

---

## 4. 状态管理设计（useAppStore）

### 4.1 字段定义

```typescript
interface AppState {
  // ─── 模式 / 专注状态 ───
  mode: AgentMode                    // IDLE | PREP | FOCUS | REVIEW
  setMode: (m: AgentMode) => void
  focusStartTs: number | null         // 进入 FOCUS 的时间戳，用于计算 duration
  enterFocus: () => void              // IDLE/PREP → FOCUS
  exitFocus: () => void               // FOCUS → REVIEW（计算 duration 写入 submission）

  // ─── 当前题目 ───
  activeProblem: Problem | null
  setActiveProblem: (p: Problem | null) => void

  // ─── 代码编辑器 ───
  code: string                       // 当前编辑器内容
  setCode: (c: string) => void
  lang: CodeLanguage                 // rust | cpp | python3 | typescript | golang | java
  setLang: (l) => void

  // ─── 对话（FOCUS 下锁定）───
  messages: ChatMessage[]
  addMessage: (m: ChatMessage) => void
  clearMessages: () => void

  // ─── 动画队列 ───
  animations: AnimationJob[]         // 所有动画任务
  activeAnimation: AnimationJob | null // 当前展示在 chat 底部的动画
  pushAnimation: (a: AnimationJob) => void
  setActiveAnimation: (a: AnimationJob | null) => void

  // ─── UI ───
  sidebarExpanded: boolean
  toggleSidebar: () => void
  theme: 'light' | 'dark'
  toggleTheme: () => void

  // ─── 提交结果 ───
  lastSubmission: Submission | null
  setLastSubmission: (s: Submission | null) => void
}
```

### 4.2 模式转换流程

```
                  ┌─────────────────────────────────────────┐
                  │                                         │
                  ▼                                         │
  ┌────────┐  选题目  ┌────────┐  点击开始  ┌────────┐  提交  ┌────────┐
  │ IDLE   │ ──────→ │ PREP   │ ─────────→ │ FOCUS  │ ────→ │ REVIEW │
  │ 空闲   │         │ 预习   │            │ 专注🔒 │       │ 复盘   │
  └────────┘         └────────┘            └────────┘       └────────┘
       │                 │                     │                  │
       │                 │                     │ 禁止 AI         │
       │                 │ AI 全功能            │ 只有 Monaco 本地建议 │ AI 全功能
       │                 │ 可触发动画           │                  │ 触发复盘动画
       │                 │                     │                  │ 更新记忆
       │                 ▼                     ▼                  ▼
       │            可随时返回 IDLE       退出即进 REVIEW      推荐下一题→PREP
       │
       └──→ 可在预习中使用 AI；登录态仅在实际调用对应题库时检查
```

**转换触发点**：
- `IDLE → PREP`：`setActiveProblem()` 且 `setMode('PREP')`
- `PREP → FOCUS`：用户点击"开始做题" → `enterFocus()`
- `FOCUS → REVIEW`：用户提交 LeetCode 并收到判题结果，或手动点击“结束专注”；手动结束时不伪造提交结果
- `REVIEW → FOCUS`：点击“继续做题”回到当前题的编辑器
- 选择其他题目：由题目面板加载成功后 `setActiveProblem(next)`，进入 `PREP`
- 任意 → `IDLE`：关闭题目 → `setActiveProblem(null)` + `setMode('IDLE')`

### 4.3 FOCUS 模式约束执行点

| 组件 | 约束 |
|------|------|
| ChatPanel | 输入框替换为锁定条，`send()` 开头判断 `isFocus` 直接 return |
| Header | LeetCode 运行/提交可用；其他平台暂不支持站内判题，按钮禁用并说明原因 |
| EditorPanel | `readOnly=false`，`quickSuggestions=true`（Monaco 本地建议；无 AI 补全） |
| ProblemPanel | 题目描述仍可滚动查看 |
| AnimationCard | 不主动推送新动画（agent 在 FOCUS 不发消息） |
| Sidebar | mode 圆点变红脉冲 |

---

## 5. 路由设计

使用 `react-router-dom v6`，路由表：

```typescript
// src/main.tsx
<BrowserRouter>
  <AppRoutes />
</BrowserRouter>

// AppRoutes.tsx
<Routes>
  <Route path="/" element={<Navigate to="/workspace" replace />} />
  <Route path="/workspace" element={<Workspace />} />
  <Route path="/progress" element={<ProgressPage />} />
  <Route path="/knowledge" element={<KnowledgeGraphPage />} />
  <Route path="/settings" element={<SettingsPage />} />
  <Route path="/settings/platforms" element={<PlatformLoginPage />} />
  <Route path="/settings/cookie" element={<CookieSetupPage />} />
  <Route path="*" element={<Navigate to="/workspace" replace />} />
</Routes>
```

**登录态控制**：`AppShell` 启动时请求 Gateway `/api/auth/status` 仅确认网关可用；未登录仍进入工作区。LeetCode、AcWing 的 Cookie 在相应题库请求时校验，错误展示在题目面板；HDU 可匿名浏览。Cookie 统一由 `/settings/platforms` 管理，`/settings/cookie` 保留为直接进入的 LeetCode 配置页。

---

## 6. 页面状态与规格

### 6.1 工作区题目选择

**路由**：`/workspace` 左侧的 ProblemPanel

**职责**：浏览 LeetCode 题目并在当前工作区加载题目详情。

**Props**：无

**内部状态**：
- `page: number`（当前页，默认 1）
- `difficulty: 'EASY' | 'MEDIUM' | 'HARD' | ''`
- `tag: string`（如 'array', 'dynamic-programming'）
- `search: string`（题目关键词搜索，前端过滤或调后端搜索）

**API 调用**：`leetcodeService.listProblems({ page, difficulty, tag })`

**当前实现**：
- 题目列表内嵌于工作区 ProblemPanel，首屏加载第一页题目；选择后拉取详情并填入当前工作区。刷新页面恢复的题目会先显示 sessionStorage 缓存，同时后台确认最新题面；更新只替换题目数据，不重置代码草稿、聊天、专注计时或当前模式。后台请求失败时保留缓存并显示重试入口，切题后迟到的旧响应会丢弃。
- 当前网关题库每页固定 50 条，尚无标签目录或关键词搜索端点；前端没有引入额外分页/缓存依赖。

### 6.2 Workspace（工作区主视图）

**路由**：`/workspace`

**职责**：渲染三栏工作区，题目由 ProblemPanel 选择并放入 Zustand store。

更换题目时会重置代码、测试结果、提交结果和 FOCUS 计时；FOCUS 期间禁止切题。

### 6.3 KnowledgeGraphPage（知识图谱）

**路由**：`/knowledge`

**职责**：可视化用户的知识掌握图谱。

**数据源**：`GET /api/agent/memory/profile` 由 Gateway 固定代理至 Agent `GET /memory/profile`，返回：
```typescript
{
  topics: { topic: string; mastery: number; attempts: number; lastSeen: string; weakSubtopics: string[]; relatedTopics: string[] }[]
  edges: { from: string; to: string; weight: number }[]
  recentProblems: { problemId: string; status: string; topics: string[]; durationSec: number; createdAt: string }[]
  dailyAttempts: { date: string; count: number }[]
  stats: { totalAttempts: number; accepted: number; averageDurationSec: number; streakDays: number }
}
```

**当前实现**：
- SVG 知识点图使用 `d3-force` 按共现边排布，节点按掌握度着色并按训练次数调节大小；可拖动节点，点击/键盘选择节点查看掌握度与相关知识点。
- 列表视图与图谱视图可切换；连线权重由实际题目上共同出现的标签计数生成，没有共同记录时不画边。
- 端点还返回最近题目与每日刷题统计，供进度页展示；图谱不提供缩放和图片导出。

### 6.4 ProgressPage（刷题进度）

**路由**：`/progress`

**职责**：仪表盘，展示刷题统计。

**数据源**：`GET /api/agent/memory/profile`，读取 Agent 的本地 episodic 与 semantic 汇总。

**当前实现**：
- KPI 展示提交次数、通过次数、平均专注用时和连续训练天数。
- 35 天 CSS 热力格、知识点掌握进度条、最近 8 条题目/提交结果；所有数据由 Agent 返回的完整历史统计生成。
- 暂无难度分布、题目下钻或分页历史视图；不增加图表依赖。

### 6.5 题库登录（统一入口）

**路由**：`/settings/platforms`（`PlatformLoginPage`）。三平台登录态集中在同一页，避免入口分散：
- **LeetCode**：粘贴 Cookie 或 Copy as cURL 的完整请求，前端提取 `LEETCODE_SESSION` / `csrftoken` 后 `POST /api/auth/cookie`，再用 `/api/auth/validate` 做真实校验；完整 curl 不写入持久化存储。
- **AcWing / 杭电 HDU**：粘贴 Cookie 请求头或整段 cURL；原文发送给本机 Gateway，由 `CookieHeader.normalize` 提取并规范成单行 `name=value; …` 后写入 SQLite。AcWing 需要 Cookie，HDU 可匿名浏览。
- AcWing 题单与题面需要有效 Cookie；HDU 不填 Cookie 也可浏览题单与题面。
- 状态栏通过 `GET /api/platforms` 一次取回三平台配置状态（LeetCode 以 `/api/auth/validate` 结果为准）；保存成功显示 3 秒确认，失败保留输入并提示。

首次启动无需先配置 Cookie；设置页和题目选择面板都提供统一的题库登录入口。

### 3.10 Provider 设置

`SettingsPage` 提供 OMP 风格的 Provider 预设（Anthropic、OpenAI、OpenAI Responses、OpenCode Go、Command Code GOAT、DeepSeek、Qwen/DashScope、Moonshot/Kimi、MiniMax、Gemini、OpenRouter、Ollama、Volcengine、xAI）和自定义端点。用户可编辑协议、Base URL、模型名和 API key；API key 只放在当前浏览器 `sessionStorage`，每次聊天按请求传给本机 Agent，不进入 SQLite、ReMe、导出文件或 Git。OpenCode Go 预设指向 `https://opencode.ai/inference/go/openai/v1`（Chat Completions），Command Code GOAT 预设指向 `https://api.commandcode.ai/provider/v1`（Responses）；Agent 对 `opencode.ai` 端点自动附加 `x-opencode-session` 请求头，否则 OpenCode Go 在鉴权前就返回 `400 MissingSessionID`。未配置页面 Provider 时，Agent 继续使用服务端 `.env` 的默认 Anthropic 配置。

设置页的“题库平台 Cookie”管理 AcWing 与可选的 HDU Cookie：通过 `POST /api/platforms/{platform}/cookie` 写入本机网关 SQLite，只显示“已配置/未配置”，不回显内容。

语言偏好、训练目标和主题保存在当前浏览器；数据导出下载 Agent 训练记忆 ZIP 与 Gateway 提交历史 JSON。提交历史导出包含用户提交代码，LeetCode Cookie 不导出。

---

## 7. Monaco Editor 集成细节

### 7.1 懒加载

```typescript
// EditorPanel.tsx
const MonacoEditor = React.lazy(() => import('@monaco-editor/react'))

// 渲染时
<Suspense fallback={<div className="flex-1 grid place-items-center text-text-muted">加载编辑器…</div>}>
  <MonacoEditor ... />
</Suspense>
```

Monaco 包体约 3MB，懒加载可让首屏不阻塞。

### 7.2 语言映射

```typescript
const LANG_MAP: Record<string, string> = {
  rust: 'rust',
  cpp: 'cpp',
  python3: 'python',
}
```

Monaco 内置支持 `rust` / `cpp` / `python` 语法高亮、括号匹配、缩进和本地建议；当前没有启动外部 LSP 服务。

### 7.3 FOCUS 模式下的约束

| 配置项 | PREP/IDLE | FOCUS | REVIEW |
|--------|-----------|-------|--------|
| `readOnly` | `true` | `false` | `false` |
| `quickSuggestions` | `false` | `true`（Monaco 本地语言建议） | `true` |
| `suggestOnTriggerCharacters` | `false` | `true` | `true` |
| `wordBasedSuggestions` | `false` | `true` | `true` |

**关键**：Monaco 本地建议不调用 AI，也不代表已接入 LSP 协议。当前没有注册自定义 AI `CompletionItemProvider`。

### 7.4 自定义 LSP 扩展（可选）

若需增强 LSP（如 Rust 的 rust-analyzer 集成），走 Web Worker：
```typescript
// onMount 中
monaco.editor.defineTheme('algocoach-dark', { ... })
monaco.languages.registerHoverProvider('rust', {
  provideHover: (model, position) => { /* 调用 Web Worker */ }
})
```

MVP 阶段不实现，用 Monaco 内置能力即可。

### 7.5 代码格式化快捷键

注册 `Ctrl+S` 格式化（不触发 AI）：
```typescript
editorRef.current.addAction({
  id: 'format-code',
  label: 'Format Code',
  keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
  run: (ed) => ed.getAction('editor.action.formatDocument').run(),
})
```

---

## 8. Remotion Player 集成

### 8.1 AnimationCard 轮询策略

```typescript
// hooks/usePollAnimation.ts
export function usePollAnimation(jobId: string | null) {
  const { setActiveAnimation } = useAppStore()
  useEffect(() => {
    if (!jobId) return
    let timer: number
    const poll = async () => {
      const job = await agentService.pollAnimation(jobId)
      if (job.status === 'READY' || job.status === 'FAILED') {
        setActiveAnimation(job)
        return  // 停止轮询
      }
      setActiveAnimation(job)
      timer = window.setTimeout(poll, 1500)  // 每 1.5s 轮询
    }
    poll()
    return () => clearTimeout(timer)
  }, [jobId])
}
```

### 8.2 自动播放策略

- `status === 'READY'` 且 `videoUrl` 存在时，`<video>` 设置 `autoPlay loop controls`
- 浏览器策略：`autoPlay` 需要静音才能自动播放，但用户已与页面交互（点击发消息），故非静音自动播放通常被允许
- 若被浏览器拦截，显示"点击播放"覆盖层

### 8.3 Remotion Player 嵌入（可选替代）

若需实时预览（非预渲染 MP4），可直接嵌入 `@remotion/player`：
```typescript
import { Player } from '@remotion/player'
import { MainComp } from '../../remotion-compositions/src/compositions/MainComp'

<Player
  component={MainComp}
  durationInFrames={240}
  fps={30}
  compositionWidth={1280}
  compositionHeight={720}
  props={{ component: 'BfsGraph', data: graphData }}
  style={{ width: '100%' }}
/>
```

**MVP 决策**：先用预渲染 MP4（更稳定、可缓存），后续再考虑实时 Player。

---

## 9. 主题系统

### 9.1 Tailwind Token 设计

```typescript
// tailwind.config.ts
colors: {
  surface: {
    DEFAULT: '#ffffff',      // 主背景
    soft:    '#f7f7f8',      // 次背景（侧边栏、面板）
    muted:   '#efefef',      // hover 背景
    dark:    '#1a1a2e',      // 深色主背景
    'dark-soft': '#16213e',  // 深色次背景
    'dark-muted': '#0f3460', // 深色 hover
  },
  accent: {
    DEFAULT: '#5b6af5',      // Qwen 靛蓝
    hover:   '#4a57e8',
    soft:    '#eef0ff',      // 浅色选中背景
    'dark-soft': 'rgba(91,106,245,0.15)',
  },
  border: { DEFAULT: '#e5e7eb', dark: '#2a2a3e' },
  text: {
    primary:   '#1a1a2e',
    secondary: '#6b7280',
    muted:     '#9ca3af',
    'dark-primary':   '#e8eaf6',
    'dark-secondary': '#9fa8c0',
    'dark-muted':     '#5c6480',
  },
  success: '#22c55e',
  warning: '#f59e0b',
  danger:  '#ef4444',
  focus:   '#ef4444',   // FOCUS 锁定红
}
```

### 9.2 双主题切换

- `darkMode: 'class'`，通过 `<html class="dark">` 切换
- `useAppStore.theme` 初始值从 `window.matchMedia('(prefers-color-scheme: dark)')` 推导
- `toggleTheme` 切换并写入 `localStorage` 的 `algocoach.theme`
- `SettingsPage` 调用 `useAppStore.toggleTheme`；`AppShell` 将主题同步到 `<html>` 的 `dark` class

```typescript
// AppShell.tsx
const { theme } = useAppStore()
useEffect(() => {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}, [theme])
```

```typescript
// SettingsPage.tsx
export function toggleTheme() {
  useAppStore.getState().toggleTheme()
}
```

### 9.3 Monaco 主题同步

```typescript
theme={theme === 'dark' ? 'vs-dark' : 'vs'}
```

---

## 10. 性能优化要点

### 10.1 代码分割

```typescript
// 路由级懒加载
const CookieSetupPage = React.lazy(() => import('@/pages/CookieSetupPage'))
const ProgressPage = React.lazy(() => import('@/pages/ProgressPage'))
const KnowledgeGraphPage = React.lazy(() => import('@/pages/KnowledgeGraphPage'))
const SettingsPage = React.lazy(() => import('@/pages/SettingsPage'))
// 每个页面 Suspense + fallback={<Spinner/>}
```

### 10.2 Monaco 懒加载

见 7.1，用 `React.lazy` 包裹 `@monaco-editor/react`。

### 10.3 动画懒加载

- `AnimationCard` 在 `status === 'READY'` 时才渲染 `<video>`，渲染中只显示骨架
- 当前没有 `IntersectionObserver` 视口虚拟化；动画卡片数量由聊天状态控制

### 10.4 对话消息虚拟化

当前消息列表直接渲染 Zustand 中的消息；没有引入 `@tanstack/react-virtual`。消息量较大时再单独评估虚拟化。

### 10.5 请求缓存

当前使用 Gateway 的题目缓存和组件级请求状态，没有引入 `@tanstack/react-query`。题目详情由 Java Gateway 按 24 小时 TTL 缓存，列表请求按页实时获取；浏览器刷新恢复时采用缓存优先、后台校验策略，离线仍可继续阅读缓存题面。
- 提交结果不缓存（每次都要最新）

### 10.6 编辑器内容防抖

`setCode` 用 `lodash.debounce(300ms)` 防抖，避免每次按键触发 store 更新 + 重渲染。

---

## 11. 测试策略

### 11.1 测试框架

Vitest + jsdom 已接入：`npm test` 运行 store 与图布局单测；`npm run test:coverage` 对这两个核心模块执行分支覆盖门槛。

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
})
```

### 11.2 单测重点

**状态机测试（最高优先级）**：
```typescript
// stores/useAppStore.test.ts
describe('AgentMode 状态机', () => {
  it('IDLE → PREP：设置题目后进入 PREP', () => {
    useAppStore.getState().setActiveProblem(mockProblem)
    useAppStore.getState().setMode('PREP')
    expect(useAppStore.getState().mode).toBe('PREP')
  })

  it('PREP → FOCUS：enterFocus 设置 focusStartTs', () => {
    useAppStore.getState().enterFocus()
    expect(useAppStore.getState().mode).toBe('FOCUS')
    expect(useAppStore.getState().focusStartTs).not.toBeNull()
  })

  it('FOCUS → REVIEW：exitFocus 清空 focusStartTs', () => {
    useAppStore.getState().enterFocus()
    useAppStore.getState().exitFocus()
    expect(useAppStore.getState().mode).toBe('REVIEW')
    expect(useAppStore.getState().focusStartTs).toBeNull()
  })
})
```

**ChatPanel FOCUS 锁定测试**：
```typescript
// components/Chat/ChatPanel.test.tsx
describe('ChatPanel FOCUS 锁定', () => {
  it('FOCUS 模式下输入框被锁定条替换', () => {
    useAppStore.setState({ mode: 'FOCUS' })
    render(<ChatPanel />)
    expect(screen.getByText(/专注解题中/)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/问 AI 教练/)).not.toBeInTheDocument()
  })

  it('非 FOCUS 模式下输入框可用', () => {
    useAppStore.setState({ mode: 'PREP' })
    render(<ChatPanel />)
    expect(screen.getByPlaceholderText(/问 AI 教练/)).toBeInTheDocument()
  })
})
```

**EditorPanel 只读测试**：
```typescript
describe('EditorPanel 只读约束', () => {
  it('PREP 模式编辑器只读', () => {
    useAppStore.setState({ mode: 'PREP', activeProblem: mockProblem })
    render(<EditorPanel />)
    // Monaco 只读属性需通过 onMount 回调断言
  })

  it('FOCUS 模式编辑器可编辑', () => {
    useAppStore.setState({ mode: 'FOCUS', activeProblem: mockProblem })
    render(<EditorPanel />)
  })
})
```

**Badge 组件测试**：
```typescript
describe('Badge', () => {
  it.each([
    ['EASY', '简单'],
    ['MEDIUM', '中等'],
    ['HARD', '困难'],
  ])('难度 %s 显示 %s', (difficulty, label) => {
    render(<Badge difficulty={difficulty as Difficulty} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
```

**主题切换测试**：
```typescript
describe('主题切换', () => {
  it('toggleTheme 切换 dark → light', () => {
    useAppStore.setState({ theme: 'dark' })
    useAppStore.getState().toggleTheme()
    expect(useAppStore.getState().theme).toBe('light')
  })
})
```

### 11.3 浏览器闭环验证

Playwright 浏览器冒烟脚本位于 `e2e/training_flow.py`，通过 route mock 验证免登录进入工作区、题目搜索、题干净化与公式排版、语言切换、FOCUS 静默与计时、Run、Submit、不包含代码的 REVIEW，以及设置偏好持久化。运行方式：先启动 `bun run dev -- --port 5174`，安装 `python -m pip install -r e2e/requirements.txt` 和 Chromium，再执行 `ALGOCOACH_FRONTEND_URL=http://localhost:5174 python e2e/training_flow.py`。可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指向本机 Chrome。脚本 mock LeetCode 与 Agent API，不使用真实账号或提交。

---

## 12. 开发顺序建议

1. ✅ **补全路由与 Cookie 状态门**（`AppShell`）
2. ✅ **题目选择视图**（内嵌 `ProblemPanel`）
3. ✅ **Workspace**（三栏工作区）
4. ✅ **usePollAnimation hook**（动画轮询）
5. ✅ **SettingsPage**（语言/目标/主题/导出设置）
6. ✅ **ProgressPage**（Agent profile stats）
7. ✅ **KnowledgeGraphPage**（本地训练掌握关系图）
8. ✅ **状态机单测**（FOCUS 计时、偏好持久化、题目切换）
9. ✅ **首屏代码分割**（按路由加载；Monaco 与语法高亮及语言语法按需加载）
10. ✅ **Playwright 浏览器流程验证**（设置、选题、FOCUS、Run、Submit、REVIEW）
