# DeepTutor 适配边界

AlgoCoach 参考 [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor) 的公开架构和教学流程，做的是面向 OI / xCPC 算法训练的独立适配。本文记录概念映射，避免把 UI 组件、Agent 运行时和学习数据边界混为一谈。

## 概念映射

| DeepTutor | AlgoCoach 当前实现 | 适配说明 |
| --- | --- | --- |
| Workspace | `/home` 学习空间 + 当前题目的本地算法 workspace | 当前是本地单 workspace；页面上的 Block 是视图组件，不是业务核心 |
| TurnApplicationService / TurnEngine | `agentService.chatStream` → Gateway → Python Agent → 本地 `agent_turns` ledger | 每个 turn 有稳定 ID、事件序号和 completed/failed 状态；已完成 turn 可通过 replay API 恢复，不重复调用模型 |
| Capability | `PREP` → `chat`，`FOCUS` → `practice`，`REVIEW` → `review`；知识图谱建议 → `mastery_path`；复杂分析 → `deep_solve` | 前后端共享有界 registry；能力会进入请求校验和 system prompt，Agent 仍按现有训练阶段执行 |
| ToolRegistry | AgentScope tools、知识库检索、记忆工具、题库和动画工具 | 工具继续由 Python Agent 注册，前端不直接调用模型或工具 |
| Practice | 本地算法题练习、样例运行、提交、复盘记录 | 使用 DeepTutor 对应的可解释 SM-2 风格冷启动规则；保留每次自评事件 |
| Mastery Path | 本地知识图谱、弱点主题和模式推荐 | 当前推荐由既有 Agent 与 mastery 数据驱动，尚未形成独立 path runner |
| Knowledge Center | `KnowledgeBasePage` 与本地知识库索引 | 文件、索引和 Provider 配置保留在本机运行时目录 |
| Learning Notebook | 本地复盘队列、练习本和笔记视图 | 当前没有单独 Notebook 服务，数据仍由前端本地状态和 Agent 记忆承载 |
| Task Board / Calendar | `/home` 本周计划、练习/复盘日期与本地任务板 | 任务以 workspace key 持久化，可安排下一页练习或到期复盘并标记完成；更完整的跨设备 calendar 留作后续 |

## Workspace 与数据边界

当前发行版是单用户、本地多 workspace，默认 ID 为 `local-default`；设置页可以创建或切换 workspace，切换后应用重载。浏览器 localStorage 的练习本、复盘队列、学习空间布局、任务板、草稿和专注记录通过 `workspaceStorageKey` 归属 workspace；默认 workspace 保留旧 key 以兼容已有数据，其他 workspace 使用隔离后缀。Agent 的 SQLite、Chroma 和 ReMe 目录保存训练记忆，Gateway SQLite 保存平台 Cookie 和判题事实。题目代码只在本轮 REVIEW 请求中发送，不写入长期记忆。

后续扩展多 workspace 时，`workspaceId` 必须成为练习记录、复盘队列、Agent session、知识库索引和 turn 的共同隔离键；迁移不能只在 UI 上增加 workspace 下拉框。

## Durable turn 当前边界

`POST /chat/stream` 接受 `turnId`、`workspaceId`、`capability` 和 `afterSequence`。Agent 在本地 SQLite 的 `agent_turns` / `agent_turn_events` 表中保存 thinking、text、done、error 事件；`POST /chat/replay` 按序返回事件，已完成 turn replay 时不会再次调用模型。当前仍是单进程模型执行：服务进程崩溃时，running turn 只保留已写入事件，不会自动恢复模型任务；桌面壳的断线重连 UI 和跨进程 work queue 留作后续阶段。

## 许可证与来源

本仓库没有复制 DeepTutor 的完整业务代码；适配的是公开架构、教学流程和练习调度思路。DeepTutor 的 Apache License 2.0 文本保存在 [`frontend/public/licenses/DeepTutor-Apache-2.0.txt`](../frontend/public/licenses/DeepTutor-Apache-2.0.txt)。本仓库自己的代码仍按根目录许可证发布，第三方运行时许可证继续在 `frontend/public/licenses/` 中单独列出。
