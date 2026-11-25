# DeepTutor 适配边界

AlgoCoach 参考 [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor) 的公开架构和教学流程，做的是面向 OI / xCPC 算法训练的独立适配。本文记录概念映射，避免把 UI 组件、Agent 运行时和学习数据边界混为一谈。

## 概念映射

| DeepTutor | AlgoCoach 当前实现 | 适配说明 |
| --- | --- | --- |
| Workspace | `/home` 分阶段学习对话 + `/workspace` 算法练习 | 学习进度按当前浏览器会话和 workspace 保存；原学习记录与模块入口位于 `/learning/dashboard` |
| TurnApplicationService / TurnEngine | `agentService.chatStream` → Gateway → Python Agent → 本地 `agent_turns` ledger | 每个 turn 有稳定 ID、事件序号和 completed/failed 状态；已完成 turn 可通过 replay API 恢复，不重复调用模型 |
| Capability | `PREP` / `IDLE` → `chat`，`FOCUS` → `practice`，`REVIEW` → `review`；知识图谱的「让导师带我走」→ 下一次 `PREP` / `IDLE` 对话使用 `mastery_path`（只生效一次，发出请求时即消费，失败后需重新点击）；`deep_solve` 目前只在 Agent 侧注册，前端尚未发送 | 前后端共享有界 registry；能力会进入请求校验和 system prompt，Agent 仍按现有训练阶段执行 |
| ToolRegistry | AgentScope tools、知识库检索、记忆工具、题库和动画工具 | 工具继续由 Python Agent 注册，前端不直接调用模型或工具 |
| Practice | 本地算法题练习、样例运行、提交、复盘记录 | 使用 DeepTutor 对应的可解释 SM-2 风格冷启动规则；保留每次自评事件 |
| Mastery Path | `GET /memory/mastery-path` + 知识图谱“下一步学习路径”；`mastery_path` 轮次在模型调用前读取一次路径快照 | 独立 path runner 读取当前 workspace 的 mastery、共同训练关系和到期复习队列；到期项优先，同一优先级按掌握度升序，返回每一步的原因和建议动作。快照每轮重新读取、不跨轮缓存，读取失败时由 `get_mastery_path` 工具兜底 |
| Knowledge Center | `KnowledgeBasePage` 与本地知识库索引 | 资料文件和索引按 workspace 隔离，embedding Provider 配置在本机共享 |
| Learning Notebook | `/notebook` 学习笔记页 + 复盘队列 | 用户笔记与 AI 笔记分开；支持生成预览、保存、删除，并按 workspace key 存储 |
| Task Board / Calendar | `/learning/dashboard` 的本周计划和本地任务板 | 任务按「待办 → 进行中 → 完成」推进，完成后可归档并恢复，以 workspace key 持久化；支持拖拽排序、方向键移动和最多 500 字的卡片备注，更完整的跨设备 calendar 留作后续 |

## 引导式学习

参考 DeepTutor 的 Mastery Study、Mastery Question Card 和 mastery loop：先讲解，再出单选题、简答题、编程题并复盘；题目作答与自由追问使用不同入口。可识别的四选一题目显示为可点击选项，其他格式仍可在文本框作答。只有教练明确评价通过，才解锁下一阶段；无法判定时保持在当前阶段。

这里的评价是模型的辅助反馈，不是 DeepTutor 的结构化题目与独立评分引擎，也不等于代码已经运行或通过判题。当前使用模型响应中的评价标记作为本地阶段切换信号；模型未按约定返回标记时不会推进。选择题由页面按 `[[答案:X]]` 标记做确定性核对（正确答案来自模型输出，不是题库），题目与作答只保存在当前标签页的 sessionStorage 中，尚未写入数据库；学习大纲编辑与跨会话掌握度同步尚未实现。流式中断不计为通过。

## Workspace 与数据边界

当前发行版是单用户、本地多 workspace，默认 ID 为 `local-default`；设置页可以创建或切换 workspace，切换后应用重载。浏览器 localStorage 的练习本、复盘队列、学习空间布局、任务板、草稿和专注记录通过 `workspaceStorageKey` 归属 workspace；默认 workspace 保留旧 key 以兼容已有数据，其他 workspace 使用隔离后缀。Agent SQLite 训练记忆、ReMe 对话目录、资料索引和题目向量索引按 workspace 隔离；非默认 workspace 的题目和错误向量文档随记忆 JSON 导出。Gateway SQLite 保存平台 Cookie 和判题事实。题目代码只在本轮 REVIEW 请求中发送，不写入长期记忆。

跨设备同步尚未实现。

## Mastery Path 的确定性边界

`GET /api/agent/memory/mastery-path?workspaceId=<id>&limit=6` 由 Gateway 固定代理到 Agent。计算过程只读取当前 workspace：

1. 读取 semantic mastery、练习次数、待加强子主题和 related topics；
2. 读取 review schedule 中已经到期的题目，把它们映射回对应知识点；
3. 用真实练习记录的共同出现关系补充相关节点；
4. 到期复习优先，同一优先级内掌握度最低的知识点优先，输出 `reason`、`recommendedAction`、`dueReviews` 和相关知识点。

路径是可解释的执行清单，不把共同出现关系自动宣称为严格前置关系；没有任何本地证据时返回空步骤和引导文案。Agent 的 `mastery_path` capability 会调用同一个 `get_mastery_path` 工具，避免聊天回复和图谱入口使用两套排序规则。

## Durable turn 当前边界

`POST /chat/stream` 接受 `turnId`、`workspaceId`、`capability` 和 `afterSequence`。Agent 在本地 SQLite 的 `agent_turns` / `agent_turn_events` 表中保存 thinking、text、done、error 事件；`POST /chat/replay` 按序返回事件，已完成 turn replay 时不会再次调用模型。当前仍是单进程模型执行：服务进程崩溃时，running turn 只保留已写入事件，不会自动恢复模型任务；桌面壳的断线重连 UI 和跨进程 work queue 留作后续阶段。

## 许可证与来源

本仓库没有复制 DeepTutor 的完整业务代码；适配的是公开架构、教学流程和练习调度思路。DeepTutor 的 Apache License 2.0 文本保存在 [`frontend/public/licenses/DeepTutor-Apache-2.0.txt`](../frontend/public/licenses/DeepTutor-Apache-2.0.txt)。本仓库自己的代码仍按根目录许可证发布，第三方运行时许可证继续在 `frontend/public/licenses/` 中单独列出。
