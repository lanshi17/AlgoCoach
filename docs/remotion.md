# Remotion 动画模块详细计划

> 运行时可选项：`REMOTION_ENABLED`（默认 `false`）。关闭时 coach 不暴露 `request_animation`、prompt 不含动画指引、`POST /animate` 返回 503，仅省 token 不影响其余模块；本文件描述的是启用后的完整能力。

## 1. 设计目标

### 为什么用程序化视频而非录屏/GIF

| 对比项 | 录屏/GIF | Remotion 程序化视频 |
|--------|----------|---------------------|
| 数据驱动 | ❌ 固定内容 | ✅ Agent 传入任意数据，每次生成定制化内容 |
| 可维护性 | ❌ 改数据要重录 | ✅ 修改 props 即可重新渲染 |
| 主题一致 | ❌ 录屏风格各异 | ✅ 统一暗色 `#0d1117` 配色，与 UI 一致 |
| 文件大小 | ❌ GIF 体积大 | ✅ MP4 H.264 压缩，体积小 |
| 个性化 | ❌ 无法针对用户 | ✅ Agent 根据用户弱点选组件、填数据 |
| 多语言 | ❌ 固定语言 | ✅ 注释文字可动态替换 |

### Agent 主动选择 vs 人工制作

Agent 可在以下场景调用 `request_animation` tool，无需用户手动触发：

- **PREP 阶段**：题目加载后，Agent 分析 `topicTags`，自动匹配最相关的预置组件并填入知识点数据
- **REVIEW 阶段**：Agent 可调用预置 `SolutionCompare` 对比算法方案；当前不读取用户源码自动生成个性化对比
- **追问时**：用户在对话中提问“这个算法怎么工作的”，Agent 判断需要动画时主动选择预置组件

---

## 2. 现有组件详细规格

### 通用约定

所有组件都：
- 通过 `MainComp` 统一路由，以 `{ component: string, data: Record<string, unknown> }` 接收 props
- 包含**默认数据**（`DEFAULT_*` 常量），确保无数据时也能预览
- 使用相同配色 token：

```ts
const C = {
  bg:      '#0d1117',  // 背景
  bg2:     '#161b22',  // 次级背景（节点填充等）
  border:  '#30363d',  // 边框
  text:    '#e6edf3',  // 主文字
  muted:   '#8b949e',  // 次级文字
  accent:  '#58a6ff',  // 蓝色强调（当前状态）
  visited: '#1f6feb',  // 已访问/已填充状态
  success: '#3fb950',  // 找到目标/完成
}
```

- 配色统一由 `src/theme.ts` 的 `C` 提供，组件不再各自定义色板
- 动画节奏由 `src/motion.ts` 统一：`useStepSequence(count)` 返回 `{ index, progress, eased, revealed }`，`sequenceDurationInFrames(count, fps)` 计算 `intro + count × 1s + outro`（3–30s 夹取）
- 时长不写死：`Root.tsx` 用 `calculateMetadata` 调 `catalog.ts` 的 `mainDurationInFrames(component, data, fps)`，agent 传 3 步就渲 4.5s，传 20 步就渲 21.5s
- 入场/高亮用 `springIn`（无过冲）与 `popIn`（轻微过冲），窗口/指针在步骤间用 `Easing.out(Easing.cubic)` 插值，不硬切

---

### 2.1 BfsGraph

**文件**：`src/compositions/BfsGraph.tsx`

```ts
interface Node { id: number; x: number; y: number; label: string }
interface Edge { from: number; to: number }

interface BfsGraphProps {
  nodes?: Node[]       // 图节点，默认 6 节点示例
  edges?: Edge[]       // 图边，默认示例边
  startNode?: number   // 起始节点 id，默认 0
}
```

**帧逻辑**：
1. 对 nodes/edges/startNode 执行 BFS，得到访问顺序数组 `order`
2. 场景时长 = `bfsGraphFrames({...}, 30)`，每步 30 帧（intro 18 帧、outro 27 帧）
3. 第 `index` 步：`order[0..index]` 标记已访问，`order[index]` 为当前节点（蓝色高亮 + 光环脉冲）
4. 底部展示访问顺序 badge 序列，每个 badge 在对应步起点用 `popIn` 弹入
5. 已访问的边变色；节点/边在开场用 `springIn` 逐个进入

**默认数据**：6 节点树形图（S, 1-5）

---

### 2.2 DpTable

**文件**：`src/compositions/DpTable.tsx`

```ts
interface Step { r: number; c: number; val: number; note?: string }

interface DpTableProps {
  title?:      string       // 标题，默认"动态规划 — 状态转移可视化"
  rowHeaders?: string[]     // 行标题数组
  colHeaders?: string[]     // 列标题数组
  table?:      number[][]   // 初始全零二维数组
  steps?:      Step[]       // 每步填入 (r,c) = val，附带说明文字
}
```

**帧逻辑**：
1. 按 `stepIdx` 逐步"解冻"单元格：`grid[r][c] = val`
2. 当前步骤的单元格用 `C.visited` 背景 + 白字高亮
3. 底部浮动显示当前 `step.note`（转移方程说明）

**默认数据**：5×6 路径计数 DP 表

---

### 2.3 SlidingWindow

**文件**：`src/compositions/SlidingWindow.tsx`

```ts
interface WindowStep { left: number; right: number; note?: string }

interface SlidingWindowProps {
  title?:  string         // 默认"滑动窗口"
  array?:  number[]       // 数组元素
  steps?:  WindowStep[]   // 每步的左右指针位置
}
```

**帧逻辑**：
1. 按 `stepIdx` 读取 `{left, right}`
2. 窗口范围 `[left, right]` 画蓝色背景框
3. L/R 指针在数组上方显示字母标记
4. 窗口边界格子加粗描边

**默认数据**：8 元素数组，6 步窗口移动

---

### 2.4 TwoPointer

**文件**：`src/compositions/TwoPointer.tsx`

```ts
type Action = 'init' | 'shrink' | 'expand' | 'found'

interface PointerStep { left: number; right: number; action: Action; note?: string }

interface TwoPointerProps {
  title?: string
  array?: number[]
  steps?: PointerStep[]
}
```

**帧逻辑**：
- `action === 'found'` 时：窗口区间变绿色
- 其余与 SlidingWindow 类似，增加 action 语义色

**默认数据**：有序数组 `[-2,-1,0,1,2,3,4,5]`，4 步收缩

---

### 2.5 WeeklyReport（P1 新增，周报专用）

**文件**：`src/compositions/WeeklyReport.tsx`

```ts
interface TopicCount { name: string; count: number }
interface WeakTopic { topic: string; mastery: number }

interface WeeklyReportProps {
  weekStart?: string
  weekEnd?: string
  totalAttempts?: number
  accepted?: number
  reviewed?: number
  topics?: TopicCount[]
  weakTopics?: WeakTopic[]
  stickingPoints?: string[]
}
```

**内容**：标题 + 日期范围、提交/通过/复盘/通过率四张统计卡、考点分布条形图（按帧增长）、薄弱考点掌握度、本周卡点。所有尺寸按 `width / 1920` 缩放，因此同一组件在 1280×720 聊天预览中也不会溢出。

**Composition 注册（`src/Root.tsx`）：**

| id | 分辨率 | 帧率 | 时长 | 用途 |
|----|--------|------|------|------|
| `MainComp` | 1280×720 | 30fps | 90–900 帧（3–30s，按数据计算） | 聊天内嵌动画，按 `{component, data}` 路由 |
| `WeeklyReport` | **1920×1080** | **60fps** | 600 帧 | 周报视频，props 直接是周报数据 |

`MainComp` 通过 `calculateMetadata` 把 `{component, data}` 交给 `catalog.ts`：步数少的场景（TwoPointer 默认 4 步）渲 5.5s，步数多的场景（HeapSort 默认 16 步）渲 17.5s，最长夹到 30s；`useStepSequence` 反向从真实 `durationInFrames` 还原步网格，所以 Studio 预览、聊天播放器和后端渲染的节奏一致。

`MainComp` 的 REGISTRY 同时注册 `WeeklyReport`，便于聊天里用 `{component: 'WeeklyReport', data: {...}}` 预览；后台周报任务则使用独立的 `WeeklyReport` composition。预置组件只消费后端传入的 JSON props，不生成也不执行任何 JSX；生成式动画走单独的沙箱路径（§5 Mode B），默认关闭。

**服务注册**：`animation_service.py` 的 `PREBUILT` 增加 `'WEEKLY_REPORT': 'WeeklyReport'`；`enqueue(..., composition_id='WeeklyReport')` 时渲染该独立 composition，其余组件仍渲染 `MainComp`。

---

## 3. 组件库扩展规范

### 新增组件 checklist

```
1. 创建文件 src/compositions/MyComp.tsx
2. 定义 Props interface（所有字段可选，提供 DEFAULT_* 常量）
3. 用 src/theme.ts 的 C、src/fonts.ts 的 MONO_FONT_STACK，
   节奏用 src/motion.ts 的 useStepSequence / springIn / popIn
4. 导出 MyCompFrames = (props: MyCompProps, fps: number) =>
     sequenceDurationInFrames(stepCount, fps)
5. 在 MainComp.tsx 的 REGISTRY 中注册：MyComp: scene(MyComp)
6. 在 catalog.ts 的 DURATIONS 中登记同一份计数：
     MyComp: (data, fps) => myCompFrames(props<MyCompProps>(data), fps)
7. 在 animation_service.py 的 PREBUILT 中注册关键词映射：
     'MY_KEYWORD': 'MyComp',
8. 更新本文档的"现有组件"节
```

### Props 约定

| 规则 | 说明 |
|------|------|
| 全部可选 | 组件必须能在 `props = {}` 时用默认数据正常渲染 |
| 扁平化 | 避免深层嵌套，agent 填 props 时 JSON 要简单 |
| steps 数组 | 所有逐步动画都用 `steps: Step[]`，每步按 1s 播放 |
| note 字段 | `Step` 中可选 `note: string`，显示在画面底部 |
| 配色统一 | 从 `src/theme.ts` 导入 `C`，不写裸色值 |
| 时长 | 在 `catalog.ts` 登记 `*Frames`，不要依赖 Composition 的静态 240 帧 |

---

## 4. 当前组件边界

Agent 使用 15 个已注册的图、数组、搜索、数据结构和解法对比组件。组件清单如下；未知主题回退到 `BfsGraph`。

| 组件 | 动画内容 |
|---|---|
| `BfsGraph` / `GridBfs` | 图层遍历 / 网格最短路 |
| `DfsTree` / `Dijkstra` | 深度优先 / Dijkstra 松弛 |
| `DpTable` / `BacktrackingTree` | DP 表 / 回溯路径 |
| `SlidingWindow` / `TwoPointer` / `BinarySearch` | 区间与双指针、二分边界 |
| `UnionFind` / `LinkedListOps` | 连通分量 / 指针操作 |
| `HeapSort` / `SortVisualizer` | 堆排序 / 插入排序 |
| `SolutionCompare` | 两种方案的思路与复杂度 |
| `WeeklyReport` | 训练统计周报 |

## 5. Agent 生成流水线

### Mode A：预置组件 + Agent 填 Props（MVP，当前实现）

```
题目数据 (topics, content)
    │
    ▼
Claude: 分析考点，调用 request_animation tool
  输入: { type, topic, title, problem_id }
    │
    ▼
animation_service.enqueue()
  → _guess_component(topic) 匹配 PREBUILT 映射表
    │
    ▼
asyncio.create_task(_render(job_id))
  → npx remotion render MainComp
    --props '{"component":"BfsGraph","data":{...}}'
    --output /data/animations/{id}.mp4
    │
    ▼
job.status = "READY", job.video_url = "/animations/{id}.mp4"
前端 AnimationCard 轮询到 READY → 展示 <video>
```

生成式动画不使用独立 props 生成器；相关输入按不可信代码处理，唯一执行路径见 Mode B 的沙箱约束。


## 6. 运行配置

当前不需要单独的 `remotion.config.ts`：入口文件由 `remotion-compositions/package.json` 的 `remotion.entryPoint` 指定，渲染参数由 Agent 的 `animation_service.py` 显式传给 CLI。预置动画和生成式沙箱使用各自的固定规格与资源限制。

`remotion-compositions/package.json`：

```json
{
  "remotion": {
    "entryPoint": "./src/index.ts"
  }
}
```

P1 同时补齐了渲染所需依赖：`react-dom@^18.3.1`（Remotion peer 依赖）与 `remotion@4.0.545` + devDependency `@remotion/cli@4.0.545`（提供 `npx remotion` 可执行文件，两者版本必须一致）。缺少 CLI 时 `npx remotion render` 会报 “could not determine executable to run”。

**升级记录（2026-11，4.0.543 → 4.0.545）**：

| 项目 | 变更 |
|------|------|
| `remotion` / `@remotion/cli` / 前端 `@remotion/player` | 统一到 `4.0.545`；`npx remotion versions` 校验全部同版本 |
| 时长 | `Root.tsx` 增加 `calculateMetadata`，场景按 `catalog.ts` 的步数计算 3–30s |
| 布局 | `MainComp` 用 1280×720 设计台，按 composition 尺寸等比缩放（默认 scale=1） |
| 字体 | `fonts.ts` 增加 `useFontGate()`：`document.fonts.ready` 前不抓帧，避免冷启动中文空白 |
| 主题/节奏 | 新增 `theme.ts` 与 `motion.ts`，各组件内联色板和逐帧硬切全部移除 |
| 渲染 | `RENDER_TIMEOUT` 120s → 240s，匹配 30s 成片上限 |

4.0.545 新增的 motion blur（`@remotion/motion-blur`）面向镜头/转场运动，本项目的教学动画是平面状态切换，未引入该依赖。

**中文字体**：渲染发生在无界面 Chromium 中，可用字体只来自宿主（Docker 渲染器即 `backend/agent/Dockerfile` 镜像）。镜像里除了 `fonts-liberation` 还必须安装 `fonts-noto-cjk`，否则中文标题、节点标签、周报正文会整段渲染成空白（数字和英文仍然正常，很容易被误判成布局问题）。Dockerfile 在安装后用 `test -n "$(fc-list :lang=zh)"` 做构建期断言；组件里的 `fontFamily` 统一取 `src/fonts.ts` 的 `MONO_FONT_STACK`（`monospace` 在前保证拉丁字符外观不变，CJK 家族在后做逐字兜底），不要在组件里再写裸 `monospace`。在宿主机直接跑 Remotion 时需自行安装 Noto Sans CJK；macOS 自带 PingFang，无需额外处理。

**`remotion-compositions/src/index.ts`**（P1 已创建；Root 保持导出 `RemotionRoot`）：

```ts
import { registerRoot } from 'remotion'
import { RemotionRoot } from './Root'
registerRoot(RemotionRoot)
```

---

## 7. 渲染命令参数设计

`animation_service.py` 中的完整渲染命令：

```python
cmd = [
    RENDER_BIN, "remotion", "render",
    "MainComp",                                    # composition id
    out_path,                                      # 输出路径
    "--props", json.dumps({                        # 动态 props
        "component": job.component,
        "data": job.props,
    }),
    "--frames", f"0-{job.duration_in_frames - 1}", # 渲染帧范围
    "--concurrency", "2",                          # 渲染并发
    "--codec", "h264",
    "--image-format", "jpeg",
    "--jpeg-quality", "80",
    "--output", out_path,
    "--log", "error",                              # 只输出错误
]
```

**当前实现（P1）**：`AnimationJob` 增加 `composition_id`，`_render()` 用 `job.composition_id` 替换上例的 `MainComp`，并省略 `--frames`（渲染 composition 全时长）。`composition_id == 'MainComp'` 时 props 为 `{component, data}`；`WeeklyReport` 等独立 composition 的 `--props` 直接是数据对象。周报仍走异步渲染，不阻塞 FastAPI 请求。

**动态时长与超时**：`--frames` 必须省略——`calculateMetadata` 已按数据算出 90–900 帧，显式传帧区间会截断场景。实测 17.5s / 525 帧在 `--concurrency 2` 下耗时约 39s（本机 20 核），30s 上限留出约 2 倍余量后 `RENDER_TIMEOUT` 取 240s。复杂度只看步数，不看题目内容。

**分辨率方案**：

| 场景 | 分辨率 | 帧率 | 说明 |
|------|--------|------|------|
| 聊天面板内嵌 | 1280×720 | 30fps | 默认，兼顾质量和渲染速度 |
| 周报视频 | 1920×1080 | 60fps | 更高质量，异步离线渲染 |
| 预览缩略图 | 320×180 | 1fps | 仅首帧，快速预览用 |

---

## 8. 视频服务方案

### MVP：FastAPI 静态文件

在 `app/main.py` 中添加：

```python
from fastapi.staticfiles import StaticFiles

app.mount(
    "/animations",
    StaticFiles(directory=os.getenv("OUTPUT_DIR", "../../data/animations")),
    name="animations",
)
```

前端通过 `http://localhost:8000/animations/{id}.mp4` 访问。

**注意**：Java gateway 也需要反向代理此路径，或前端直连 8000 端口。

### 生产：CDN 分发（未来）

```
渲染完成
    │
    ▼
上传到对象存储（OSS/S3）
job.video_url = "https://cdn.example.com/animations/{id}.mp4"
    │
    ▼
CDN 边缘节点缓存，全球加速
```

---

## 9. Remotion Player 在前端的集成

### 安装

```bash
npm install @remotion/player
```

### AnimationCard 完整实现参考

```tsx
import { Player } from '@remotion/player'
import { MainComp } from '../../../remotion-compositions/src/compositions/MainComp'
import { mainDurationInFrames } from '../../../remotion-compositions/src/catalog'

// 注意：Remotion Player 在 Web 中直接渲染 React 组件（无需渲染 MP4）
// 两种模式：
// 1. 直接用 Player 组件播放（无需后端渲染）——适合实时预览
// 2. 用 <video> 播放已渲染的 MP4——适合分享/离线
// Player 不会执行 calculateMetadata，时长要自己从 catalog 取同一份计算。

function AnimationPlayer({ job }: { job: AnimationJob }) {
  if (job.status === 'READY' && job.videoUrl) {
    // 已渲染完成：播放 MP4
    return <video src={job.videoUrl} controls autoPlay loop />
  }

  // 实时预览（无需渲染）：直接用 Player
  return (
    <Player
      component={MainComp}
      inputProps={{ component: job.component, data: job.props }}
      durationInFrames={mainDurationInFrames(job.component, job.props, 30)}
      fps={30}
      compositionWidth={1280}
      compositionHeight={720}
      style={{ width: '100%' }}
      controls
      autoPlay
      loop
    />
  )
}
```

**自动播放时机**：
- `AnimationCard` 在轮询拿到 `READY` 后渲染视频并提供 controls
- 当前没有基于视口的自动暂停或 `IntersectionObserver`；多动画并发由聊天状态和后端渲染队列控制

---

## 10. 性能优化

### 并发渲染限制

`animation_service.py` 中加信号量：

```python
import asyncio

_render_semaphore = asyncio.Semaphore(2)  # 最多同时 2 个渲染任务

async def _render(self, job_id: str) -> None:
    async with _render_semaphore:
        # ... 渲染逻辑
```

### Props Hash 去重

相同题目 + 相同组件不重复渲染：

```python
import hashlib, json

def _props_hash(self, component: str, props: dict) -> str:
    raw = json.dumps({"component": component, "data": props}, sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()[:12]

async def enqueue(self, ...) -> AnimationJob:
    cache_key = self._props_hash(component, props or {})
    # 检查已有完成的 job
    for job in self._jobs.values():
        if (job.status == "READY"
                and self._props_hash(job.component, job.props) == cache_key):
            return job  # 直接返回缓存
    # 否则新建
    ...
```

### 视频文件清理

每天定时清理超过 7 天的渲染文件：

```python
# crons.py 中
async def cleanup_old_animations():
    cutoff = time.time() - 7 * 24 * 3600
    for f in Path(OUTPUT_DIR).glob("*.mp4"):
        if f.stat().st_mtime < cutoff:
            f.unlink()
```

---

## 11. 测试策略

### 单元测试：Props 合法性

```ts
// remotion-compositions/src/__tests__/BfsGraph.test.tsx
import { renderStill } from '@remotion/renderer'
import { BfsGraph } from '../compositions/BfsGraph'

test('BfsGraph 用默认 props 渲染第 0 帧不报错', async () => {
  await expect(
    renderStill({
      composition: { component: BfsGraph, defaultProps: {}, ... },
      output: '/tmp/test-frame.png',
      frame: 0,
    })
  ).resolves.not.toThrow()
})
```

### 截图对比（快照测试）

```ts
test('BfsGraph 第 30 帧与快照一致', async () => {
  const { buffer } = await renderStill({ ..., frame: 30, imageFormat: 'png' })
  expect(buffer).toMatchSnapshot()
})
```

### 生成代码安全测试（P2）

`backend/agent/tests/test_remotion_codegen.py` 覆盖：恶意 import/表达式/JSX/路径与 props 上限、功能开关默认值、token 缺失/错误/正确路径与“先于 JSON 校验”的拒绝顺序、generated job 容量与失败/超时/取消释放、bwrap/systemd 缺失时 fail-closed、临时目录在失败/取消后清理、输出 symlink/超大/非 MP4 拒绝、ffprobe 元数据探测确实走 bwrap 而非宿主；真实测试还会运行 bwrap preflight（namespace、只读挂载、cgroup、超时杀组、Chrome 渲染、沙箱内 ffprobe）和一次完整 MP4 渲染。所有真实测试均在 `--unshare-net` 内离线运行，不连接 LLM/Gateway/网络。

### 集成测试：渲染流水线

```python
# backend/agent/tests/test_animation_service.py
import pytest
from unittest.mock import AsyncMock, patch
from app.remotion.animation_service import AnimationService

@pytest.mark.asyncio
async def test_enqueue_returns_queued():
    svc = AnimationService()
    with patch.object(svc, '_render', new_callable=AsyncMock):
        job = await svc.enqueue(kind='PRE_EXPLAIN', topic='BFS', title='BFS 讲解')
    assert job.status == 'QUEUED'
    assert job.component == 'BfsGraph'

@pytest.mark.asyncio
async def test_props_hash_dedup():
    svc = AnimationService()
    # 手动设置一个已完成的 job
    from app.remotion.animation_service import AnimationJob
    cached = AnimationJob(id='abc', kind='PRE_EXPLAIN', title='t', topic='BFS',
                          problem_id=None, component='BfsGraph', props={},
                          status='READY', video_url='/animations/abc.mp4')
    svc._jobs['abc'] = cached
    with patch.object(svc, '_render', new_callable=AsyncMock) as mock_render:
        job = await svc.enqueue(kind='PRE_EXPLAIN', topic='BFS', title='t')
    mock_render.assert_not_called()  # 应该命中缓存，不触发渲染
    assert job.id == 'abc'
```

---

## 当前 PREBUILT 关键词映射

`animation_service.py` 只提供已注册的组件：`BfsGraph`、`DpTable`、`SlidingWindow`、`TwoPointer` 和 `WeeklyReport`。关键词不匹配时回退到 `BfsGraph`。
