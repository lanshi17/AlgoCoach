# AlgoCoach 前端模块详细计划

> 技术栈：React 18 + Vite + TypeScript + TailwindCSS + Zustand + Monaco Editor + Remotion Player
> 当前实现：左侧导航 + 三栏刷题工作区；Agent 请求统一经 Java Gateway 的 `/api/agent/*`。

---

## 1. 模块职责和边界

### 职责
- 渲染 DeepTutor Workspace 风格的学习空间与三栏编码工作区（题目描述 / 代码编辑器 / AI 对话）
- 维护 `AgentMode` 状态机，强制执行 FOCUS 模式下的 AI 静默约束
- 通过 Java 网关 (`/api/*`) 拉取题目、提交代码、管理 Cookie 认证
- 通过 Java 网关 (`/api/agent/*`) 与 Python Agent 对话、请求动画
- 渲染 Remotion 动画，轮询渲染状态自动播放
- 双主题（浅色/深色）切换

### 边界（前端不做的事）
- 不直接调用 LeetCode GraphQL（由 Java 网关代理）
- 不直接调用 Claude API（由 Python agent 服务代理）
- 不在 FOCUS 模式下显示任何 AI 相关 UI（包括补全、提示、chat 输入框）
- 代码草稿和当前题目保存在本机 localStorage，并按 workspace key 隔离，以便重新打开应用后继续练习；后端 episodic 只保存判题状态、题目标签与用时，不保存源码，并随当前 workspace 归属
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
    │   ├── guidedPlan.ts           # AI 大纲解析、阶段校验与默认路径
    │   ├── guidedCodeTemplates.ts  # 引导式编程阶段的语言模板
    │   └── agentService.ts         # axios → /api/agent/* (Gateway → Python agent)
    ├── hooks/
    │   └── usePollAnimation.ts     # 轮询动画渲染状态
    ├── components/
    │   ├── Layout/
    │   │   ├── AppShell.tsx        # 顶层布局：Sidebar + Header + 三栏
    │   │   ├── Sidebar.tsx         # Qwen 风格可折叠左侧导航
    │   │   ├── Header.tsx          # 题目标题、mode 徽章、运行/提交按钮
    │   │   ├── ColumnResizer.tsx   # 可拖拽/键盘调整的分隔条（只报告宽度）
    │   │   ├── FloatingPanelChrome.tsx      # 浮窗标题栏：拖动、最大化、嵌入
    │   │   ├── FloatingPanelResizeHandle.tsx # 浮窗右下角缩放柄
    │   │   ├── floatingPanel.ts    # FloatRect 校验与视口钳制
    │   │   ├── layoutStorage.ts    # 版本化布局信封的打包/解包
    │   │   ├── useLayoutStorageSync.ts      # 跨标签页布局同步
    │   │   └── README.md           # 布局与面板子系统规格
    │   ├── Editor/
    │   │   ├── EditorPanel.tsx     # Monaco 编辑器容器 + PREP 蒙层
    │   │   ├── GuidedCodeEditor.tsx # 引导式编程阶段的代码区与提交
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
    │       ├── Badge.tsx           # 难度徽章
    │       ├── Button.tsx          # 唯一按钮原语（primary/secondary/ghost）
    │       └── PageHeader.tsx      # 唯一页面标题（图标 + 标题 + 右侧操作）
    └── pages/
        ├── LearningSpacePage.tsx    # Block 学习空间：摘要、练习、复盘、计划、洞察
        ├── SettingsPage.tsx        # 目标/AI 教练/Provider/题库登录/备份/跨设备同步
        ├── ProgressPage.tsx        # 训练进度
        ├── KnowledgeGraphPage.tsx  # 掌握关系图
        ├── KnowledgeBasePage.tsx   # 用户知识库、Embedding 与源文件管理
        └── graphLayout.ts          # 图布局算法

题目列表视图内嵌在 `ProblemPanel`；工作区和其他路径由 `AppShell` 管理，没有独立的 `ProblemListPage` / `WorkspacePage` 文件。`/home` 为分阶段引导式学习页（`GuidedLearningPage`）；借鉴 DeepTutor 的 Workspace 思路，Block 视图位于 `/learning/dashboard`（`LearningSpacePage`），编码练习仍由 `/workspace` 承载。知识图谱和进度页面已接入本地 Agent profile。
```

---

## 3. 已有组件详细规格

### 3.1 AppShell.tsx

**职责**：顶层布局容器，组合 Sidebar + Header + 三栏工作区，并管理三栏的宽度、停靠/浮动状态和持久化。

**Props**：无（从 store 读取所有状态）

**内部逻辑**：
- `useEffect` 监听 `theme` 变化，切换 `<html>` 的 `dark` class
- 当 `mode === 'FOCUS'` 时，在顶部渲染 `focus-mode-bar`（红色细条 + 脉冲动画）
- 三栏宽度由 `WorkspaceLayout` 状态驱动：题目栏默认 `420px`、对话栏默认 `360px`（各 280–720 / 260–560），编辑器栏 `flex-1`。`>=1280px` 时在每个面板边缘渲染 `ColumnResizer`，宽度写入 CSS 变量 `--problem-w` / `--chat-w`
- `xl` 布局工具条提供四个预设（均衡 / 宽编辑器 / 宽题目 / 宽教练）、「我的布局」保存、重置，以及每个面板的「独立/嵌入」开关
- 面板「独立」后改为 `position: fixed` 浮窗，由 `FloatingPanelChrome` 拖动、最大化，由 `FloatingPanelResizeHandle` 缩放；被浮动的面板在网格中留下同宽占位块，内容组件始终挂载，切换停靠状态不会重建 Monaco 或聊天
- 布局通过 `layoutStorage.packLayout`（版本信封）写入 `workspaceStorageKey('algocoach.workspaceLayout')`，120ms 防抖；`useLayoutStorageSync` 接收其他标签页的 `storage` 事件
- `useLayoutStorageSync` / `ResizeObserver` 分别处理跨标签页和窗口尺寸变化；窗口缩放时用 `clampFloatRect` 把浮窗拉回视口

**FOCUS 语义**：
- 对话面板在停靠和浮动两种形态下都隐藏；窄屏标签页同步移除「AI 教练」，宽屏布局工具条也隐藏该面板的独立开关
- 隐藏而不是强制停靠：`ChatPanel` 保持挂载，聊天状态与浮窗位置在结束专注后原样恢复

**已实现**：
- `<React.Suspense>` 包裹 Monaco 编辑器，实现懒加载
- `ProblemPanel` / `EditorPanel` / `ChatPanel` 经 `React.memo` 隔离拖拽重渲染
- React Router 按 URL 切换工作区、进度、知识图谱和设置页面

### 3.2 Sidebar.tsx

**职责**：Qwen 风格可折叠左侧 icon 导航。

**Props**：无

**内部状态**：
- 从 store 读取 `sidebarExpanded`、`toggleSidebar`、`theme`、`toggleTheme`
- `NAV_ITEMS` 常量定义六个导航项及其目标路径：`/home`（学习空间）/ `/workspace`（编码练习）/ `/progress`（刷题进度）/ `/knowledge`（侧栏“知识图谱”）/ `/notebook`（学习笔记）/ `/settings`（设置）

**关键逻辑**：
- 折叠时宽 `72px`，展开时 `272px`，通过 `transition-[width] duration-200` 平滑过渡；`/workspace`（编码练习）固定使用 `72px` 图标栏，且不显示展开/折叠按钮
- 底部提供主题切换按钮：图标随当前主题变化，展开时文字显示可切换到的模式（“深色模式”或“浅色模式”）
- 展开/折叠按钮固定在底部，图标用 `ChevronLeft/Right`

**已实现**：
- `NAV_ITEMS` 使用 `/home`、`/workspace`、`/progress`、`/knowledge`、`/notebook`、`/settings` 路径；`NavLink` 负责切换和当前项高亮。
- `/` 与未知路径默认重定向至 `/home`（学习空间）。
- `/progress` 使用 Agent 本地 profile 数据，`/knowledge/graph` 使用 profile 与掌握路径数据；`/settings` 提供偏好设置，`/settings/platforms` 是 LeetCode / AcWing / 杭电 HDU 三平台登录态的统一入口。
- `/knowledge/library` 提供用户知识库管理：选择本地 ONNX 或 OpenAI-compatible embedding、上传 TXT/Markdown/JSON/CSV/HTML/PDF/DOCX/ZIP、重建索引和删除源文件。
- AppShell 启动时只检查 Java Gateway（探测超时后进入离线态）；网关不可用时保留完整桌面工作区并显示重试入口，本地练习本仍可打开。LeetCode 未登录不会阻挡工作区，题库请求失败时在题目面板内显示平台错误并提供登录设置入口。

### 3.3 Header.tsx

**职责**：顶栏，显示题目标题、难度徽章、语言选择、mode 徽章、运行/提交按钮、主题切换。

**Props**：无

**内部逻辑**：
- 语言选择器 `select`，值 `rust` / `cpp` / `python3` / `typescript` / `golang` / `java`，写入 store 的 `lang`
- LeetCode 的 `onRun` 调用 `leetcodeService.runTests()`；两道内置题选择 Python 时可在本机运行，样例有预期结果，自定义输入只显示返回值。运行结果或失败信息显示在测试区。
- `onSubmit` 调用 `leetcodeService.submit()`，提交累计 FOCUS 用时；返回终态后保存结果并切换 REVIEW。
- `mode === 'FOCUS'` 时 mode 徽章显示红色 `Lock` 图标
- 运行/提交仅在 FOCUS 模式可用；请求期间显示 loading 并阻止重复提交。REVIEW 可继续做题，重试阶段的 FOCUS 时间会累计。
- Gateway 保存提交后将判题事实、用时和题目标签写入 Agent episodic/semantic 记忆；前端随后发送 `review` 阶段消息，并附上当前编辑器代码与语言，让 Agent 可以检查本轮实际提交。

**当前行为**：Agent 回复通过 `/api/agent/chat/stream` 以 SSE 流式呈现；思考状态默认折叠为一行，模型返回思考事件时可展开查看，文本回复也会逐段出现。

### 3.4 EditorPanel.tsx

**职责**：Monaco 代码编辑器容器 + 底部测试用例/提交结果切换。

**Props**：无

**关键逻辑**：
- `MONACO_LANGUAGES`（`services/languages.ts`）：前端 lang → Monaco language id（`rust→rust`, `cpp→cpp`, `python3→python`, `typescript→typescript`, `golang→go`, `java→java`）
- `isEditable = mode === 'FOCUS' || mode === 'REVIEW'`：PREP/IDLE 下编辑器只读
- PREP 模式下显示半透明蒙层 + "开始做题" 按钮，点击调用 `enterFocus()`
- Monaco `quickSuggestions` 绑定到 `isEditable`：FOCUS 下显示离线词语联想和六种语言的本地关键字/算法模板补全，不接入 AI 补全
- 选题后使用当前语言对应的 LeetCode starter code；切换语言只更新 Monaco 语言标识，不覆盖用户编辑内容。
- `MonacoCodeEditor` 使用 Monaco 树摇入口 `monaco-editor/editor`，只注册 Rust、C++、Python、TypeScript、Go、Java 六种语法定义和本地 `CompletionItemProvider`，并统一使用本地 editor worker；不启动外部语言服务器，保持离线加载。C++ 补全支持 `std::` 类型/算法，以及已识别 STL 容器的 `. / ->` 成员方法（如 `vector.size`、`priority_queue.top`）。

**Monaco 配置要点**：
```typescript
{
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  minimap: { enabled: false },
  readOnly: !isEditable,
  quickSuggestions: { other: true, comments: false, strings: false },
  wordBasedSuggestions: 'currentDocument',
  suggestOnTriggerCharacters: true,
  tabSize: 4,
  padding: { top: 12, bottom: 12 },
}
```

**当前边界**：
- LeetCode Run 不会提供测试 case 的期望输出时，结果区域按实际回包显示，不推算缺失字段。

本地练习本提供两道不依赖平台 Cookie 的算法题。Python 代码可在带不透明来源和网络限制的 iframe / Web Worker 中通过本地 Pyodide 运行，运行时间限制为 3 秒；内置样例可比较结果，自定义输入只显示返回值，不代表完整判题。当前尚无硬性内存配额，运行器用于用户自己的练习代码。其他语言暂不支持本地运行或提交。题目、语言 starter、代码草稿和专注时长保存在浏览器本地；结束一次 FOCUS 会写入本地练习账本，进度页在 Agent 不可达时以此账本作为离线视图。

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
- 发送：调用 `agentService.chatStream(content, { mode, problemId })`，返回 `{ content, animationId }`
- Submit 结束后自动以 `trainingPhase: 'review'` 发送判题状态、通过数、用时和题目标签；提交代码不随复盘请求发送。
- 消息追加：用户消息立即追加，agent 消息等 API 返回后追加
- 等待期间显示三点跳动动画 + “思考中…”。
- `loading` 时发送按钮变为停止按钮（`aria-label="停止生成"`），点击会 abort 当前请求、清空 thinking 与流式文本、追加“已停止生成。”系统消息并立即恢复输入状态；abort 不计为错误，不出现重试入口，Agent 侧 turn 仍可按 turn id replay。停止只结束本客户端的流，不发送服务端取消协议。
- `activeAnimation` 存在时在消息流末尾渲染 `<AnimationCard>`

**当前行为**：对话按题目保存在进程内 Zustand 状态，切换题目后可返回原对话；刷新页面会清空，避免把用户代码写入浏览器存储。Submit 结束后发送判题摘要和当前代码的临时上下文启动赛后复盘；代码不写入 ReMe 长期记忆。动画生成期间加入 system 状态消息。聊天文本和可用的 thinking block 通过 SSE 流式到达。

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
- 平台选择：LeetCode / AcWing / 杭电 HDU。LeetCode 保留专项+难度筛选；AcWing 专项走站点的标签搜索（`ACWING_TOPICS`，如 `模拟`、`二分`、`动态规划`），打开题目时附六语言 starter 模板；HDU 无标签/难度，仅浏览题面。在线运行/提交仅对 LeetCode 可用；两道内置题支持本地 Python 运行。
- 题名/slug 搜索只在当前页内过滤，不改变服务端筛选。
- 无题目时显示空状态占位（Play 图标 + 引导文字）
- 有题目时：难度徽章 + 每日一题标签 + topic 标签 + HTML 内容（`dangerouslySetInnerHTML`）
- PREP 模式底部显示"开始做题"CTA，点击 `enterFocus()`
- PREP/IDLE 模式标题栏显示「拆解思路」：把 `deep_solve` 排队到下一轮对话；输入框为空时预填题目拆解提示（模型、不变量、证明思路、复杂度、反例），并打开 AI 教练（移动端切换到教练面板，浮窗教练置前）。不会自动发送，也不会覆盖已有草稿；FOCUS 和 REVIEW 不显示该入口。

**当前行为**：题干经过 DOMPurify 白名单净化后再渲染。收藏和返回顶部快捷按钮不在当前训练闭环内。

### 3.8 AnimationCard.tsx

**职责**：在对话流中嵌入 Remotion 动画卡片。

**Props**：`{ job: AnimationJob }`

**状态渲染**：
- `QUEUED` / `RENDERING`：骨架屏 + 旋转 Loader + "正在生成动画：{title}"
- `READY` + `videoUrl`：`<video>` 自动播放 + 循环 + 控制条
- `FAILED`：显示通用错误并提供重试操作

轮询由 `usePollAnimation` hook 按 1.5 秒间隔执行；卸载或切换题目时清理定时器。

### 3.9 题库登录只有一个页面

题库登录统一使用 `/settings/platforms`，LeetCode 的 Cookie / cURL 粘贴与校验在该页的 LeetCode 卡片里完成。

### 3.10 GuidedLearningPage.tsx

**路由**：`/home`

**职责**：分阶段引导式学习页。先用 Agent 规划大纲，再由教练按阶段讲解、出选择题/简答题/编程题，最后复盘。

**内部状态**：
- `topic` / `activeTopic`：待开始与进行中的学习主题
- `stages` / `planSource`：当前大纲；`ai` 表示由 `buildGuidedPlanPrompt` 返回并解析，`default` 表示使用 `DEFAULT_GUIDED_STAGES`，`edited` 表示学习者保存过页内编辑
- `stage` / `answered` / `questionId` / `choiceQuestions`：阶段推进与选择题判分
- `messages`、`draft`、`busy`、`planning`、`error`、`errorAction`：对话流与错误修复入口
- `code` / `codeLang`：编程阶段的作答与语言
- `layout`：大纲/代码栏宽度、折叠状态、代码浮窗位置，写入 `workspaceStorageKey('algocoach.guidedLayout')`（版本信封 + 120ms 防抖 + 跨标签页同步）
- 学习会话快照：主题、大纲、当前阶段、消息、选择题作答、代码与语言写入 `workspaceStorageKey('algocoach.guidedLearning')` 的 localStorage（版本信封）；旧版 sessionStorage 数据在首次读取时自动迁移，重置主题时清除。快照只在本机浏览器，不写入 Agent 记忆或工作区导出。
- 大纲编辑：点击学习路径旁的铅笔进入编辑态，可改名、改类型、编辑教练指令、上下移动、删除和添加阶段；保存前校验名称非空且唯一、教练指令非空且不超过 600 字、最多 8 个、最后一个必须是复盘、至少保留一个编程阶段。修改类型时，未在本轮编辑过指令的阶段会换成新类型的默认指令；当前阶段的类型或指令改变会清空已判定的作答并显示「重新出题」。保存后标记为 `edited` 并随快照持久化；当前阶段按 id 保留，当前阶段不允许删除。
- 大纲栏在桌面端独立滚动，保存/取消固定在栏底；长大纲或展开多条教练指令时不会把操作按钮推出视口。
- 掌握度同步：选择题按 `[[答案:X]]` 确定性判分通过、简答/编程阶段被教练评价通过时，把主题、阶段 id、语言和阶段用时以 `GUIDED_ACCEPTED` 排入 workspace 队列并 POST `/api/agent/memory/record`。`client_id` 由 workspace、`conversationId` 和阶段 id 组成，刷新或重复通过幂等；离线保留队列，下次打开页面重试。大纲栏显示「正在同步 / 已同步 / 等待同步」，只发送主题与元数据，不发送对话或代码。恢复大纲时保留阶段 id，避免幂等键因重新归一化而变化。

**关键逻辑**：
- 「开始学习」先调用 `planOutline()` 让 Agent 输出 JSON 大纲，`parseGuidedPlan()` 归一化类型、补齐编程阶段、保证唯一复盘阶段并限制为 8 个阶段；解析失败回退默认路径
- 刷新页面、关闭标签页或重启浏览器后恢复上次大纲、阶段、对话和代码；恢复不重新调用规划，已持久化的 `questionId`、作答与阶段进度共同决定解锁状态
- 每个阶段只发一次进入指令；作答通过 `[[评价:通过]]` / `[[评价:再练]]` / `[[评价:未评分]]` 判定，未通过时「下一步」保持禁用
- 阶段类型决定代码区、选择题卡与提交控制；当前阶段缺少可用题目时统一显示「重新出题」，由学习者显式触发新的模型请求
- 编程阶段显示右侧代码区（`lg` 以下为堆叠），隐藏/浮动态与宽度均可调整；切换语言时，只有初始模板会被替换，用户代码保持不变
- 代码区顶部的「LeetCode 实战」可选绑定真实题目：展开后按当前主题加载 LeetCode 题库，选中题目会读取官方语言模板并载入代码区（已有自定义代码先确认）；「运行样例」和「提交 LeetCode」通过 Gateway 的 `/api/run`、`/api/submit` 使用本机 Cookie，AC 会把当前阶段标记通过并同步 guided mastery。它不读取前端 Cookie，也不会在页面加载时自动请求；没有 Cookie 或网络失败时显示设置入口。未绑定题目时仍可使用原有「提交代码」让教练评估。
- 错误回复通过 `getAgentErrorAction()` 显示跳转设置页的修复入口

**FOCUS 语义**：教练静默，代码编辑器保持可编辑（本地写代码不是 AI 能力），但「提交代码」禁用并在状态栏提示「专注模式 · 教练静默」；结束专注后可继续提交评估。

### 3.11 GuidedCodeEditor.tsx

**职责**：引导式编程阶段的 Monaco 代码区、语言切换、模板恢复与提交。

**Props**：
```typescript
{
  code: string
  language: CodeLanguage
  disabled: boolean        // 编辑锁定（请求中 / 尚无题目）
  busy: boolean
  submitted: boolean
  focusQuiet?: boolean     // FOCUS：可编辑，但禁止 AI 评估提交
  onChange: (code: string) => void
  onLanguageChange: (language: CodeLanguage) => void
  onResetTemplate: () => void
  onSubmit: () => void
}
```

**约束**：
- 初始模板来自 `GUIDED_CODE_TEMPLATES`；`isGuidedCodeTemplate()` 为真时禁用提交并提示「请先在模板基础上实现解法」
- 「恢复模板」需 `window.confirm` 二次确认，避免覆盖用户代码
- Monaco 使用与 `EditorPanel` 相同的本地补全配置，不接入 AI 补全


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
| AppShell 对话栏 | 停靠或浮动都 `hidden`；窄屏标签页、宽屏布局工具条均不出现「AI 教练」入口；内容保持挂载以便恢复 |
| Header | LeetCode 运行/提交可用；两道内置题支持本地 Python 运行；其他平台暂不支持站内判题 |
| EditorPanel | `readOnly=false`，`quickSuggestions=true`（Monaco 本地建议；无 AI 补全） |
| GuidedCodeEditor | 代码可编辑；「提交代码」禁用并显示「专注模式 · 教练静默」；结束专注后才能请求评估 |
| ProblemPanel | 题目描述仍可滚动查看 |
| AnimationCard | 不主动推送新动画（agent 在 FOCUS 不发消息） |
| Sidebar | mode 圆点变红脉冲 |

---

## 5. 路由设计

使用 `react-router-dom v6`，路由表：

```typescript
// src/main.tsx
<BrowserRouter>
  <AppShell />
</BrowserRouter>

// AppShell.tsx 中的 AppRoutes 函数
<Routes>
  <Route path="/" element={<Navigate to="/home" replace />} />
  <Route path="/home" element={<GuidedLearningPage />} />
  <Route path="/learning/dashboard" element={<LearningSpacePage />} />
  <Route path="/workspace" element={<Workspace />} />
  <Route path="/progress" element={<ProgressPage />} />
  <Route path="/knowledge" element={<KnowledgeBasePage />} />
  <Route path="/knowledge/graph" element={<KnowledgeGraphPage />} />
  <Route path="/knowledge/library" element={<KnowledgeBasePage />} />
  <Route path="/notebook" element={<NotebookPage />} />
  <Route path="/settings" element={<SettingsPage />} />
  <Route path="/settings/platforms" element={<PlatformLoginPage />} />
  <Route path="*" element={<Navigate to="/home" replace />} />
</Routes>
```

**登录态控制**：`AppShell` 启动时请求 Gateway `/api/auth/status` 仅确认网关可用；未登录仍进入工作区。LeetCode、AcWing 的 Cookie 在相应题库请求时校验，错误展示在题目面板；HDU 可匿名浏览。Cookie 统一由 `/settings/platforms` 管理。

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

**当前实现**：
- 布局状态（题目/对话宽度、每个面板的停靠/浮动态、浮窗位置、`maximized`、自定义预设）保存在 `workspaceStorageKey('algocoach.workspaceLayout')`，刷新与跨标签页后恢复；`unpackLayout` 兼容旧版直接对象与版本信封
- 恢复时会校验数值范围并按当前工作区宽度收敛，损坏或越界的数据回退默认布局
- 浮窗采用 `fixed` 定位（z-index 91/92），不经过 Portal；面板内容始终挂载，拖拽只更新布局状态
- 断点与 CSS 对齐：`ColumnResizer` 的 `.workspace-resizer` 与 `matchMedia('(min-width: 1280px)')` 必须同时修改

### 6.3 KnowledgeGraphPage（知识图谱）

**路由**：`/knowledge/graph`

**职责**：可视化用户的知识掌握图谱。

**数据源**：`GET /api/agent/memory/profile` 由 Gateway 固定代理至 Agent `GET /memory/profile`，返回知识图谱和进度汇总；页面同时请求 `GET /api/agent/memory/mastery-path` 获取当前 workspace 的下一步学习路径。路径按到期复习优先、掌握度升序排列，并展示每一步的原因、建议动作和到期题目：
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

首次启动无需先配置 Cookie；题库登录只保留设置页一个入口，题目选择面板不再重复该链接。

### 3.10 Provider 设置

`SettingsPage` 提供 OMP 风格的 Provider 预设（Anthropic、OpenAI、OpenAI Responses、OpenCode Go、Command Code GOAT、DeepSeek、Qwen/DashScope、Moonshot/Kimi、MiniMax、Gemini、OpenRouter、Ollama、Volcengine、xAI）和自定义端点。用户可编辑协议、Base URL、模型名和 API key；API key 只放在当前浏览器 `sessionStorage`，每次聊天按请求传给本机 Agent，不进入 SQLite、ReMe、导出文件或 Git。OpenCode Go 预设指向 `https://opencode.ai/inference/go/openai/v1`（Chat Completions），Command Code GOAT 预设指向 `https://api.commandcode.ai/provider/v1`（Responses）；Agent 对 `opencode.ai` 端点自动附加 `x-opencode-session` 请求头，否则 OpenCode Go 在鉴权前就返回 `400 MissingSessionID`。桌面前端首次运行默认选择本机 Ollama（`127.0.0.1:11434/v1`，`qwen3:8b`），并在发送前显示 Provider 与模型；只有不携带请求级 Provider 的直接 Agent 调用才使用服务端 `.env` 默认配置。

**AI 教练**：四个偏好，`localStorage` 键 `algocoach.coachPrefs`，随每次 `/chat/stream` 请求发送：

| 偏好 | 请求字段 | 生效位置 |
|------|----------|----------|
| 自动赛后复盘 | —（仅前端） | 提交成功后是否自动发起复盘对话；关闭时只留一条“提交已记录”系统消息 |
| 显示思考过程 | —（仅前端） | 聊天里的思考过程是否可展开；关闭时只显示单行“正在思考…” |
| 动画讲解 | `animations` | 关闭时 system prompt 去掉动画指引，tool 分发直接拒绝并说明原因 |
| 教练风格 | `coachStyle` | `auto` / `socratic`（先反问）/ `direct`（直接给结论），后端追加到 system prompt |

设置页的“题库平台 Cookie”管理 AcWing 与可选的 HDU Cookie：通过 `POST /api/platforms/{platform}/cookie` 写入本机网关 SQLite，只显示“已配置/未配置”，不回显内容。

语言偏好、训练目标和主题保存在当前浏览器；数据导出现在下载 `algocoach-workspace.json`、Agent 训练记忆 ZIP 与 Gateway 提交历史 JSON。提交历史导出包含用户提交代码，LeetCode Cookie 不导出。

设置页的「本地数据备份」可以导入同一 `algocoach-workspace-v1` JSON（最多 5 MB）。导入只补充当前 workspace 中不存在的任务、笔记、练习记录、复盘和复盘事件；同 id / problemId 的本机记录始终保留，不覆盖、不删除。复盘事件按 `problemId + reviewedAt + rating` 去重，重复导入幂等；练习记录已满 80 条时不会挤掉本机记录。校验失败的封套整体拒绝，单条格式无效的记录跳过并在结果中计数。布局、引导式对话、代码、Provider 密钥和 Agent 记忆不在导入范围；文件中的源 workspace 只作为提示，数据写入当前 workspace。

设置页的「跨设备掌握度与复习计划」导出/导入 `algocoach-mastery-v2` JSON：`GET /api/agent/memory/mastery-export` 返回 `{format, exportedAt, workspaceId, topics, reviewSchedules}`，`POST /api/agent/memory/mastery-import` 合并到当前 workspace。知识点取较高 `mastery`、较大 `attempts` 和较新 `lastSeen`；复习计划按 `updatedAt` 取较新状态，通知字段（`notified_on` / `last_notified_at`）保留本机，远程 `source_episode_id` 不导入。重复导入、双向导入和乱序导入都收敛；不导入提交记录、对话、代码或训练统计。前端接受 v1 包（仅知识点）和 v2 包，校验 JSON、格式、条目字段、取值范围和 5000 条上限；文件超过 2 MB 直接拒绝。来源 workspace 与当前不同时只提示，不阻止合并。

自动同步使用同一个 v2 包和同一个合并规则：设置页填写共享同步服务的 Gateway 地址和 `ALGOCOACH_SYNC_TOKEN` 后，前端在启动、每 60 秒、页面重新可见和网络恢复时，先导出本地包，`POST {hub}/api/agent/memory/sync?workspaceId=...`（带 `X-AlgoCoach-Sync-Token`），再把服务端合并后的包导入本机。定时器与 visibility/online 监听由 `startAutoSyncLoop` 统一管理，注入 runner 的测试覆盖启动、间隔、隐藏跳过、恢复可见、online 和清理。服务端未配置令牌时端点返回 503；令牌错误返回 403。两台设备必须使用相同 workspace ID；跨 Origin 访问时，hub 的 Gateway 还要通过 `ALGOCOACH_ALLOWED_ORIGINS` 放行网页 Origin。令牌只保存在本机 localStorage，不进入导出包、日志或 Git。后台失败会记录时间与最长 200 字的安全错误并通知设置页；成功同步清除该记录，失败不会打断训练，也不会记录令牌或请求包体。

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

Monaco 为 `rust` / `cpp` / `python` / `typescript` / `go` / `java` 注册本地关键字和算法常用结构候选，配合当前文档词语联想。当前没有启动外部 LSP 服务，因此不提供类型检查、符号跳转或项目级语义补全。

### 7.3 FOCUS 模式下的约束

| 配置项 | PREP/IDLE | FOCUS | REVIEW |
|--------|-----------|-------|--------|
| `readOnly` | `true` | `false` | `false` |
| `quickSuggestions` | `false` | `true`（本地关键字、算法结构和文档词语候选） | `true` |
| `suggestOnTriggerCharacters` | `false` | `true` | `true` |
| `wordBasedSuggestions` | `false` | `true` | `true` |

**说明**：候选由本地 Monaco `CompletionItemProvider` 提供，不调用 AI；这不是 LSP 语义服务，也没有注册自定义 AI 补全。

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
- 主题的唯一切换入口是 `Sidebar` 底部按钮；`AppShell` 将主题同步到 `<html>` 的 `dark` class

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

Playwright 浏览器冒烟脚本位于 `e2e/training_flow.py`，通过 route mock 验证免登录进入工作区、题目搜索、题干净化与公式排版、语言切换、FOCUS 静默与计时、Run、Submit、带代码上下文的 REVIEW，以及设置偏好持久化。运行方式：先启动 `bun run dev -- --port 5174`，安装 `python -m pip install -r e2e/requirements.txt` 和 Chromium，再执行 `ALGOCOACH_FRONTEND_URL=http://localhost:5174 python e2e/training_flow.py`。可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指向本机 Chrome。脚本 mock LeetCode 与 Agent API，不使用真实账号或提交。

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


### 本地复习调度

本地复盘条目借鉴 DeepTutor 的可解释 SM-2 风格冷启动规则安排复习日期。应用不会把显示提醒视为完成复习，用户需要先回忆、展开笔记并自评；这是一套本地默认调度，尚未根据个人数据拟合参数，也不宣称是 FSRS。每次自评都会追加一条复盘事件（localStorage 键 `algocoach.localReviewEvents`，与复盘笔记一样经 `workspaceStorageKey` 按工作区隔离，并随工作区导出为 `reviewEvents`），记录评分及评分前后的到期时间，供以后评估或替换调度算法；进度页「复习评分记录」按时间倒序展示最近 20 次自评及据此安排的下次间隔，完整日志仍保留并随工作区导出。事件与调度推进作为一个整体写入：调度写入失败时事件一并回滚，因此重试同一次评分只记录一次；另一标签页已经评分并推迟的复习，本次评分会被忽略。复盘笔记不再按 100 条截断，避免静默丢失较早笔记的复习计划；事件日志同样没有上限，后续需要时再设计归档策略。今日回想每轮最多显示 20 条（`REVIEW_ROUND_LIMIT`，对应 DeepTutor 的每轮上限），其余到期笔记在本轮完成后依次出现。复盘可以标记为「已掌握」：此时它暂停每日安排、不再进入今日回想，对它的评分也会被忽略；取消标记后调度原样恢复，若原定日期已过，笔记会重新进入今日回想。


本地专注记录会排入本地同步队列；Agent 可用时通过 `/api/agent/memory/record` 写入本地记忆，离线时保留队列并在下一次打开工作区时重试；每条记录带客户端幂等键，服务端会拒绝重复写入。`LOCAL_PRACTICE` 只创建知识点占位，不把未运行的专注时长误算成通过或失败；本地样例通过和失败会分别同步为 `LOCAL_ACCEPTED` / `LOCAL_FAILED`。

进度页的本地练习本会显示样例通过、样例未通过或未运行，以及该记录是否仍在等待 Agent 同步。

学习空间的“本周计划”使用本地练习结束时间和复盘完成时间统计，不再显示固定的练习/复盘数字；日历实心标记练习，空心标记复盘。

任务板按「待办 → 进行中 → 完成」推进，点击状态标签即可切换；完成的任务可以归档，归档后仍保存在本地，并可在「已归档」中恢复。任务不再截断到 100 条，归档历史不会被静默丢弃。只带 `completed` 标记的旧任务按该标记读作「完成」或「待办」。任务按本地保存的顺序展示，可拖动左侧手柄调整顺序，也可聚焦手柄后用 ↑/↓ 键移动；顺序按工作区保存在本地，不再按到期日自动重排。每张卡片可添加最多 500 字备注，保存后显示在标题下方，可再次编辑或清空；归档时备注一并保留。

本地同步队列保存完整练习记录而不只是 ID，因此即使本地练习本达到滚动上限，离线期间产生的记录仍可在恢复连接后同步。
