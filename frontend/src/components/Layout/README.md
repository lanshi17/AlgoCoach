# Layout & Panel System

> AlgoCoach 的前端外壳：认证门禁、桌面/移动导航、三栏工作区、可拖拽分栏，以及可独立浮动的面板原语。

这个模块不负责题库、Agent 或判题逻辑；它负责**把页面装进正确的壳里**，并在 `>=1280px` 的工作区中管理「题目 / 编辑器 / AI 教练」三块面板的宽度、停靠状态、浮动位置和持久化。

---

## Quick Start

### 1. 一个可拖拽的侧栏

`ColumnResizer` 只报告宽度，不持有布局状态。调用方负责宽度、持久化和响应式。

```tsx
import { useState } from 'react'
import ColumnResizer from '@/components/Layout/ColumnResizer'

export function ResizableSidebar() {
  const [width, setWidth] = useState(320)

  return (
    <div className="flex h-full min-h-0">
      <aside className="relative shrink-0" style={{ width }}>
        <div className="h-full overflow-hidden">侧栏内容</div>
        <ColumnResizer
          side="right"
          width={width}
          min={240}
          max={520}
          defaultWidth={320}
          label="调整侧栏宽度"
          onResize={setWidth}
        />
      </aside>
      <main className="min-w-0 flex-1">主内容</main>
    </div>
  )
}
```

要点：`aside` 必须是 `relative`，并且不能被 `overflow-hidden` 裁掉；分隔条通过 `right: -6px` 伸入相邻间距。

### 2. 一个可独立浮动的面板

`FloatingPanelChrome` 只渲染标题栏和处理拖动，不渲染外层浮窗。外层位置/尺寸由调用方控制。

```tsx
import { useState } from 'react'
import FloatingPanelChrome from '@/components/Layout/FloatingPanelChrome'
import FloatingPanelResizeHandle from '@/components/Layout/FloatingPanelResizeHandle'
import { clampFloatRect, type FloatRect } from '@/components/Layout/floatingPanel'

export function DetachablePanel() {
  const [floating, setFloating] = useState(false)
  const [rect, setRect] = useState<FloatRect>({ x: 120, y: 80, width: 520, height: 600 })

  return (
    <div
      className={floating
        ? 'fixed flex min-h-0 flex-col overflow-hidden rounded-panel border bg-surface shadow-2xl'
        : 'relative flex min-h-0 flex-col'}
      style={floating ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height, zIndex: 90 } : undefined}
    >
      {floating && (
        <div className="order-first shrink-0">
          <FloatingPanelChrome
            title="题目"
            rect={rect}
            onRectChange={next => setRect(clampFloatRect(next))}
            onDock={() => setFloating(false)}
          />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">面板内容</div>
      {floating && (
        <FloatingPanelResizeHandle
          label="调整面板大小"
          rect={rect}
          onResize={next => setRect(clampFloatRect(next))}
        />
      )}
    </div>
  )
}
```

---

## Architecture

```text
main.tsx
└─ BrowserRouter
   └─ AppShell
      ├─ auth gate
      │  ├─ checking  → full-screen "正在连接 AlgoCoach…"
      │  ├─ offline   → warning bar + Sidebar + AppRoutes
      │  └─ ready     → Sidebar + AppRoutes + MobileTabBar
      ├─ focus bar / cookie-invalid banner
      ├─ Sidebar                 (desktop, md+)
      ├─ MobileTabBar            (mobile, <md)
      └─ AppRoutes
         ├─ /home                → GuidedLearningPage (uses ColumnResizer / FloatingPanelChrome)
         ├─ /workspace           → Workspace
         │  ├─ Header             (run / submit / review)
         │  ├─ layout state       (widths, modes, floats)
         │  ├─ panel toolbar      (docked / floating toggles)
         │  └─ ProblemPanel | EditorPanel | ChatPanel
         ├─ /learning/dashboard  → LearningSpacePage
         ├─ /progress            → ProgressPage
         ├─ /knowledge           → KnowledgeBasePage
         ├─ /notebook            → NotebookPage
         └─ /settings[/platforms]→ SettingsPage / PlatformLoginPage
```

数据流：

```text
useAppStore (Zustand)
   ├─ theme / mode / activeProblem
   ├─ code / lang / run & submit state
   ├─ chat messages / provider / coachPrefs
   └─ sidebarExpanded / focus timers

AppShell
   ├─ subscribes to auth, theme, mode, activeProblem
   ├─ renders routes lazily
   └─ keeps focus checkpoint alive while FOCUS

Workspace
   ├─ owns layout: problemWidth, chatWidth, modes, floats
   ├─ persists layout per workspace key
   ├─ reads real container width via ResizeObserver
   └─ renders panels from the store-backed leaf components
```

### Module map

| File | Responsibility |
|------|----------------|
| `AppShell.tsx` | Auth gate, shell layout, route table, FOCUS checkpoint, cookie banner, `/workspace` implementation |
| `Header.tsx` | Problem title, language, mode, focus timer, run/submit, automatic REVIEW handoff |
| `Sidebar.tsx` | Desktop navigation, theme toggle, expand/collapse; `/workspace` forced compact |
| `MobileTabBar.tsx` | Mobile bottom navigation, mirrors `Sidebar` routes |
| `ColumnResizer.tsx` | Accessible pointer/keyboard column divider |
| `FloatingPanelChrome.tsx` | Draggable title bar + "嵌入布局" action for detached panels |
| `FloatingPanelResizeHandle.tsx` | Bottom-right resize grip for detached panels |
| `useLayoutStorageSync.ts` | Applies layout changes written by another tab |
| `floatingPanel.ts` | `FloatRect` type, viewport clamping, persisted-rect validation |
| `layoutStorage.ts` | Versioned `{ version, layout }` storage envelope + legacy migration |
| `*.test.ts(x)` | Auth, mobile panel, wide layout, storage, focus checkpoint, header, sidebar tests |

---

## Public API

### `AppShell`

```ts
export default function AppShell(): JSX.Element
```

No props. It expects to be rendered inside a router (currently `BrowserRouter` in `main.tsx`).

Responsibilities:

- Redirects `/` and unknown paths to `/home`.
- Probes `GET /api/auth/status` with an 8s timeout; concurrent probes share one module-level promise.
- Keeps all routes available in `offline` mode, with a retry banner.
- Listens for `window` events:
  - `algocoach:cookie-invalid` → show LeetCode cookie warning.
  - `algocoach:cookie-valid` → clear warning.
- In `FOCUS` with an active problem, checkpoints focus duration every second, on `pagehide`, and on `visibilitychange` when hidden.
- Flushes queued local practice records once on mount.

### `Header`

```ts
export default function Header(): JSX.Element
export function formatDuration(seconds: number): string
```

Renders the workspace command header. It is only mounted by `Workspace`, not by `/home`.

`formatDuration` formats seconds as `MM:SS` or `H:MM:SS`:

```ts
formatDuration(59)    // "00:59"
formatDuration(3600)  // "1:00:00"
```

Header behavior:

- Language selector is disabled in `FOCUS`.
- Run is available for LeetCode and two local Python practice problems.
- Submit is LeetCode-only; local practice can run samples but not submit.
- On successful submit, it exits FOCUS and either:
  - posts a plain system message when `coachPrefs.autoReview` is off, or
  - sends a structured REVIEW turn with problem, verdict, duration, topics, and code.
- Run/submit errors are cleared when the active problem changes.

### `Sidebar`

```ts
export default function Sidebar(): JSX.Element
```

No props. Reads `useLocation`, `useAppStore`.

- Hidden below `md`; mobile uses `MobileTabBar`.
- `compactRoute = pathname.startsWith('/workspace')` forces the 72px icon rail even if `sidebarExpanded` is true, protecting editor width.
- Theme toggle is owned here, not in `Header`.
- Expand/collapse control is hidden on `/workspace`.

### `MobileTabBar`

```ts
export default function MobileTabBar(): JSX.Element
```

No props. Hidden at `md` and above. Route list is duplicated from `Sidebar`; update both when adding navigation.

### `ColumnResizer`

```ts
interface ColumnResizerProps {
  side: 'left' | 'right'
  width: number
  min: number
  max: number
  defaultWidth: number
  label: string
  variant?: 'guided' | 'workspace'
  onResize: (width: number) => void
}

export default function ColumnResizer(props: ColumnResizerProps): JSX.Element
```

| Prop | Type | Meaning |
|------|------|---------|
| `side` | `'left' \| 'right'` | Which edge of the panel owns the handle. Determines drag direction. |
| `width` | `number` | Current width in px; the component is controlled. |
| `min` / `max` | `number` | Clamp bounds. Also exposed as `aria-valuemin/max`. |
| `defaultWidth` | `number` | Double-click reset width. |
| `label` | `string` | Accessible name, e.g. `调整代码区宽度`. |
| `variant` | `'guided' \| 'workspace'` | Controls CSS visibility breakpoint: guided `>=1024px`, workspace `>=1280px`. Default `guided`. |
| `onResize` | `(width: number) => void` | Called with the next width during drag/keyboard. Caller stores it. |

Behavior:

- Pointer drag uses `setPointerCapture` and `document.body.classList.add('is-resizing-columns')`.
- `ArrowLeft` / `ArrowRight` adjust by 16px; direction is inverted for a left-edge handle.
- `role="separator"`, vertical orientation, `tabIndex=0`.
- CSS handles are `.column-resizer`, `.column-resizer-left/right`, `.guided-resizer`, `.workspace-resizer`.

### `FloatingPanelChrome`

```ts
interface FloatingPanelChromeProps {
  title: string
  rect: FloatRect
  onRectChange: (rect: FloatRect) => void
  onDock: () => void
  onActivate?: () => void
  maximized?: boolean
  onToggleMaximize?: () => void
}

export default function FloatingPanelChrome(props: FloatingPanelChromeProps): JSX.Element
```

| Prop | Type | Meaning |
|------|------|---------|
| `title` | `string` | Display name, e.g. `编辑器`. |
| `rect` | `FloatRect` | Current `{ x, y, width, height }`. Only `x/y` change during drag. |
| `onRectChange` | `(rect) => void` | Reports a new position; caller clamps/persists. |
| `onDock` | `() => void` | "嵌入布局" action. |
| `onActivate` | `() => void \| undefined` | Optional bring-to-front callback for multiple floats. |
| `maximized` | `boolean \| undefined` | Disables title-bar movement and shows the restore action. |
| `onToggleMaximize` | `() => void \| undefined` | Renders the maximize/restore button when provided. |

Behavior:

- Drag starts only on the header, and not on `button/a/input/select/textarea`.
- `x` is clamped to `8 .. innerWidth - 120`; `y` to `8 .. innerHeight - 120`.
- The header is focusable; `ArrowLeft/Right/Up/Down` move the window by 16px. Arrow keys are ignored while the "嵌入布局" button has focus.
- When `maximized` is true the header is not draggable and keyboard movement is disabled.
- Width and height are owned by the caller and adjusted by `FloatingPanelResizeHandle`.
- Adds `is-moving-panel` to `<body>` for `cursor: grabbing` and disabled selection.

### `FloatingPanelResizeHandle`

```ts
interface FloatingPanelResizeHandleProps {
  rect: FloatRect
  label: string
  minWidth?: number
  minHeight?: number
  onResize: (rect: FloatRect) => void
}

export default function FloatingPanelResizeHandle(props: FloatingPanelResizeHandleProps): JSX.Element
```

| Prop | Type | Meaning |
|------|------|---------|
| `rect` | `FloatRect` | Current position and size. |
| `label` | `string` | Accessible name, e.g. `调整代码区浮窗大小`. |
| `minWidth` / `minHeight` | `number \| undefined` | Defaults: `320` / `240`. |
| `onResize` | `(rect) => void` | Next rect; x/y stay fixed, width/height are clamped to the viewport. |

Behavior:

- Bottom-right `18×18` grip; pointer drag resizes from the current rect.
- `ArrowRight/Down` grow by 16px; `ArrowLeft/Up` shrink.
- Width is capped at `innerWidth - rect.x - 8`; height at `innerHeight - rect.y - 8`.
- Adds `is-resizing-floating-panel` to `<body>` during pointer resize.
- CSS hook: `.floating-resize-handle`.

### `floatingPanel`

```ts
export interface FloatRect {
  x: number
  y: number
  width: number
  height: number
}

export function clampFloatRect(rect: FloatRect): FloatRect
export function readFloatRect(value: unknown, fallback: FloatRect): FloatRect
```

- `clampFloatRect` enforces min `320×240`, keeps the panel within the viewport, and leaves 8px margins.
- `readFloatRect` validates persisted JSON and falls back to a clamped default.
- Both read `window.innerWidth/innerHeight`; they run in the browser only.

### `layoutStorage`

```ts
export const LAYOUT_STORAGE_VERSION = 3

export function packLayout(layout: unknown, version?: number): string
export function unpackLayout(value: string | null | undefined): unknown
```

- `packLayout` writes `{"version":3,"layout":{...}}`.
- `unpackLayout` accepts both the versioned envelope and the legacy direct-object format, so layouts written before versioning keep working.
- v1 layouts lack `maximized` / `codeMaximized`; v2 layouts lack `customPreset`. Readers default those fields to `false` / `null`.
- Malformed JSON returns `null`; callers then fall back to their validated default layout.
- The version is currently informational; shape validation in `readWorkspaceLayout` / `readGuidedLayout` remains the source of truth.

### `useLayoutStorageSync`

```ts
export function useLayoutStorageSync(
  storageKey: string,
  onExternal: (newValue: string | null) => void,
): void
```

- Listens for `storage` events and calls `onExternal` only when `event.key` matches.
- The callback is stored in a ref, so the listener is installed once per key.
- Callers normally call `readWorkspaceLayout()` / `readGuidedLayout()` and skip the state update when the normalized JSON matches the current layout.
- `newValue === null` means another tab removed the key; callers reset to their default layout.

---

## Internal Design

### Auth and shell states

`AppShell` has three top-level states:

```ts
type AuthState = 'checking' | 'ready' | 'offline'
```

- `checking`: blocking centered loader.
- `offline`: warning bar plus full route tree and sidebar; the app remains usable for local practice and drafts.
- `ready`: normal shell.

`checkAuthStatus()` deduplicates concurrent requests with `authStatusRequest`. The retry button starts a fresh request. This is covered by the StrictMode and gateway-failure tests.

### Workspace layout state

`Workspace` is internal to `AppShell.tsx`. Its persisted shape:

```ts
type WorkspacePanelKey = 'problem' | 'editor' | 'chat'
type WorkspacePanelMode = 'docked' | 'floating'

interface WorkspaceLayout {
  problemWidth: number
  chatWidth: number
  modes: Record<WorkspacePanelKey, WorkspacePanelMode>
  maximized: Record<WorkspacePanelKey, boolean>
  customPreset: { problemWidth: number; chatWidth: number } | null
  floats: Record<WorkspacePanelKey, FloatRect>
}
```

Persistence:

- Layout key: `algocoach.workspaceLayout`, scoped by `workspaceStorageKey(...)`.
- Stored format: `{"version":3,"layout":{ "problemWidth":420, "chatWidth":360, "modes":{...}, "maximized":{...}, "customPreset":null, "floats":{...} }}`.
- Legacy direct-object layouts are read through `unpackLayout` and continue to work.
- Narrow-screen active tab: `algocoach.workspacePanel` in `sessionStorage`.
- Route state `{ openPanel: 'problem' | 'editor' | 'chat' }` overrides the saved tab.
- `FOCUS` forces the narrow active tab to `editor`; returning from `FOCUS` to `REVIEW` selects `chat`.

### Width calculation

The workspace is only a three-column layout at `>=1280px`.

```text
availableWidth = max(0, containerWidth - 24px page padding)
usableWidth    = max(280 + 260 + 200, availableWidth - 2 * 12px gaps)
resizeSpace    = max(280 + 260, usableWidth - 200px editor minimum)

problemLimit = clamp(PROBLEM_MIN..PROBLEM_MAX, resizeSpace - chatWidth)
chatLimit    = clamp(CHAT_MIN..CHAT_MAX,       resizeSpace - problemWidth)
```

Constants:

| Constant | Value |
|----------|------:|
| `PROBLEM_MIN` / `PROBLEM_MAX` | 280 / 720 |
| `CHAT_MIN` / `CHAT_MAX` | 260 / 560 |
| `EDITOR_MIN` | 200 |
| `WORKSPACE_GAP` | 12 |
| `WORKSPACE_PADDING_X` | 24 |

The actual container width comes from `ResizeObserver`, not `window.innerWidth`. This matters because the sidebar can be 72px or 272px, and the editor must not be squeezed to zero by stale viewport math.

### Docked vs floating

Key invariant: **panel content stays mounted when switching modes.**

- Docked panels are flex children; widths come from CSS variables `--problem-w` / `--chat-w` set on the workspace row.
- Floating panels keep the same wrapper element but switch to `position: fixed`, with inline `left/top/width/height/z-index`.
- Floating windows are moved by `FloatingPanelChrome` and resized from the bottom-right by `FloatingPanelResizeHandle`; x/y stay fixed while the resize handle adjusts width/height.
- Maximize keeps the stored rect untouched and applies inset geometry (`left/top/right/bottom: 8`) instead; restoring or docking returns to the stored rect. The resize grip is hidden while maximized.
- On every window `resize`, all stored floats are passed through `clampFloatRect` again, so shrinking the viewport cannot leave a panel stranded off-screen.
- A dashed placeholder in the original slot keeps the grid/flex geometry stable and gives the user an "嵌入布局" target.
- Content wrapper stays `flex min-h-0 flex-1`; the floating chrome is a sibling, not a replacement parent.
- `frontPanel` controls z-index (`91` normal, `92` active).

**FOCUS suppresses the coach in every form.** `isFloating()` returns false for `chat` while `mode === 'FOCUS'`, the docked chat wrapper gets a bare `hidden` (no `xl:flex`), the placeholder and chrome are not rendered, and the toolbar drops the chat detach button. The wrapper is hidden, not docked, so `ChatPanel` stays mounted and the floating position is restored when FOCUS ends. Do not "simplify" this by force-docking: that would discard the user's float rect.

### Layout presets

The wide workspace toolbar exposes a `select[aria-label="布局预设"]` control. Applying one sets both column widths, docks all three panels, and clears maximize. Float rects are preserved for later detaching.

The select reflects the current layout:

- Exact width match + all panels docked + nothing maximized → preset id.
- Saved custom widths (`我的布局`) → `saved`.
- A manual divider drag, floating panel, or maximize → `custom` / 「自定义」.

The toolbar's 「保存」 action stores the current `problemWidth` / `chatWidth` as `customPreset`. Reset preserves this saved preset; applying any built-in preset keeps it available in the dropdown.

| Preset | `problemWidth` | `chatWidth` |
|--------|---------------:|------------:|
| 均衡 | 420 | 360 |
| 宽编辑器 | 300 | 300 |
| 宽题目 | 620 | 280 |
| 宽教练 | 300 | 520 |

### Layout reset

- Workspace: the wide-layout toolbar has a "重置" action that restores default widths, docks every panel, clears maximize, and resets float positions. It keeps the saved 「我的布局」 preset.
- Guided learning: the header "重置" action restores the outline/code widths, opens both columns, docks the code window, and clears code maximize.
- Both resets are `setLayout` calls with defaults; the workspace reset preserves `customPreset`, and the same debounced persistence writes the result.
- Panel components are memoized (`React.memo`) because they read their own data from Zustand. Dragging a divider or toggling dock/float updates layout state without re-rendering `ProblemPanel`, `EditorPanel`, or `ChatPanel`.

### Cross-tab sync

- `/workspace` and `/home` both subscribe with `useLayoutStorageSync`.
- A write in another tab is re-read through the same validated `readWorkspaceLayout()` / `readGuidedLayout()` path.
- The state update is skipped when the normalized JSON equals the current layout, so the debounced writer does not echo the same value back.
- Conflicts are last-writer-wins; there is no operation log or merge.
- Removing the storage key from another tab resets the receiving tab to `defaultWorkspaceLayout()` / `defaultGuidedLayout()`.

Breakpoint behavior:

- `<1280px`: tabs (`nav[aria-label="工作区面板"]`); only the active panel mounts, except `ChatPanel` always stays mounted to preserve streaming.
- `>=1280px`: all three panels render; resizers and the "面板布局" toolbar appear.
- Below `1280px`, floating modes are ignored for rendering (panels stay docked), but the persisted modes are preserved so widening the window restores them. This prevents a narrow tab from clobbering a wide tab's floating layout through cross-tab sync.

### Guided learning consumer

`/home` is not inside this directory, but it consumes the same primitives:

- Outline and code widths use `ColumnResizer` with the guided breakpoint.
- Code can detach to a floating window using `FloatingPanelChrome`, with `FloatingPanelResizeHandle` for size and maximize/restore controls.
- The guided code footer can restore the current language template after a confirmation prompt.
- Provider/key/endpoint errors in planning or chat render a direct link to `/settings` instead of a dead-end error.
- `codeMaximized` is persisted in `GuidedLayout`; docking or reset clears it.
- Guided layout uses the same `packLayout` / `unpackLayout` envelope under `algocoach.guidedLayout`.
- The guided page's resize listener re-clamps `codeFloat` alongside `viewportWidth`.
- Guided code floating is gated to `>=1024px`.
- The code `section` stays first in DOM order; the floating chrome is rendered after it with `order-first`, so the Monaco subtree does not remount when toggling float.
- In `FOCUS`, `focusQuiet` keeps the code editable and disables only the assessment submit, matching the workspace rule that local writing stays available while the coach is silent.

### Header submission pipeline

The header is the only place that combines judge results with the coach:

```text
onSubmit()
  ├─ leetcodeService.submit(...)
  ├─ setLastSubmission(...)
  ├─ exitFocus()
  └─ coachPrefs.autoReview
     ├─ false → add system message
     └─ true  → add REVIEW user turn
                → agentService.chatStream(...)
                ├─ stream into one agent message
                ├─ replace with final content
                └─ failure → retryable system message
```

The stream is guarded by `canCommitChatReply` and by comparing the active problem; a late response from an old problem must not land in the new conversation.

---

## Usage Patterns

### 1. Persisted resizable panel

```tsx
import { useEffect, useState } from 'react'
import ColumnResizer from '@/components/Layout/ColumnResizer'
import { workspaceStorageKey } from '@/services/deepTutorCapabilities'

const WIDTH_KEY = workspaceStorageKey('algocoach.examplePanelWidth')

export function PersistedPanel() {
  const [width, setWidth] = useState(() => {
    const raw = localStorage.getItem(WIDTH_KEY)
    const saved = raw === null ? Number.NaN : Number(raw)
    return Number.isFinite(saved) ? Math.min(640, Math.max(240, saved)) : 320
  })

  useEffect(() => { localStorage.setItem(WIDTH_KEY, String(width)) }, [width])

  return (
    <aside className="relative h-full shrink-0" style={{ width }}>
      <div className="h-full overflow-hidden">面板内容</div>
      <ColumnResizer
        side="right"
        width={width}
        min={240}
        max={640}
        defaultWidth={320}
        label="调整面板宽度"
        onResize={setWidth}
      />
    </aside>
  )
}
```

The parent must leave the resizer's negative offset visible. Do not put `overflow-hidden` on the element that owns the handle.

### 2. Persist and restore a floating rect

```ts
import { clampFloatRect, readFloatRect, type FloatRect } from '@/components/Layout/floatingPanel'
import { workspaceStorageKey } from '@/services/deepTutorCapabilities'

const FLOAT_KEY = workspaceStorageKey('algocoach.exampleFloat')

export function loadFloat(): FloatRect {
  let raw: unknown = null
  try { raw = JSON.parse(localStorage.getItem(FLOAT_KEY) ?? 'null') } catch { /* ignore corrupt JSON */ }
  return readFloatRect(raw, { x: 120, y: 80, width: 520, height: 600 })
}

export function saveFloat(rect: FloatRect): void {
  localStorage.setItem(FLOAT_KEY, JSON.stringify(clampFloatRect(rect)))
}
```

`readFloatRect` validates every number; callers should never trust raw localStorage.

### 3. Add a lazy route

```tsx
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const GuidedLearningPage = lazy(() => import('@/pages/GuidedLearningPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

export function MinimalRoutes() {
  return (
    <Suspense fallback={<div className="p-4 text-sm">正在打开页面…</div>}>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<GuidedLearningPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Suspense>
  )
}
```

### 4. Add a navigation item

The desktop and mobile lists are intentionally duplicated; update both.

```tsx
import { BookOpen, Code2, LayoutDashboard } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/home', icon: LayoutDashboard, label: '学习空间' },
  { to: '/workspace', icon: Code2, label: '编码练习' },
  { to: '/notebook', icon: BookOpen, label: '学习笔记' },
] as const
```

`Sidebar` and `MobileTabBar` both map this shape through `NavLink`. `end={to === '/home'}` prevents `/home` from matching every nested path.

---

## Extension Guide

### Adding a fourth workspace panel

1. Extend `WorkspacePanelKey` in `AppShell.tsx`.
2. Add a label to `WORKSPACE_PANELS`.
3. Add defaults to `DEFAULT_WORKSPACE_LAYOUT.modes` and `DEFAULT_WORKSPACE_LAYOUT.floats`.
4. Update `readWorkspaceLayout()` validation.
5. Render a placeholder when floating and a wrapper with `data-workspace-panel`.
6. If the panel has a fixed width, add a `ColumnResizer`; if it flexes, use `xl:flex-1`. Floating panels additionally mount `FloatingPanelResizeHandle`.
7. Include it in the narrow-screen tab list if it should be reachable on mobile.
8. Update `AppShell.test.tsx` wide-layout test.

### Changing the wide breakpoint

There are two coupled places:

- CSS: `@media (min-width: 1280px)` for `.workspace-resizer`.
- JS: `window.matchMedia('(min-width: 1280px)')` in `Workspace`.

If only one changes, the handle can appear while the layout is still mobile, or floating can be enabled without a resizable grid.

### Common pitfalls

- **Resizer clipped:** the panel wrapper must be `relative` and not `overflow-hidden`; clip the inner content instead.
- **Content remounts on float toggle:** do not conditionally swap the panel component between two parents. Change the wrapper's class/style and keep children stable. In guided code, keep the section first and use `order-first` for the chrome.
- **Chat request lost:** `ChatPanel` must stay mounted on narrow screens even when hidden. The current code intentionally renders it unconditionally.
- **Floating panel off-screen:** clamp positions with `clampFloatRect`; `FloatingPanelChrome` only clamps drag movement, not restored JSON.
- **Stale persisted data:** always validate numbers and modes in `readWorkspaceLayout`; unknown values must fall back, not crash the workspace.
- **Z-index stacking:** floating panels use 91/92; the focus bar uses 50 and the cookie banner uses 100. Do not place floats under the shell's `overflow-hidden` without verifying.
- **Header error leakage:** clear `submitError` / `actionError` when the active problem changes.

---

## Performance Notes

- **Layout persistence is debounced 120ms.** `Workspace` and `GuidedLearningPage` persist the whole layout in an effect keyed on the layout object; the timer resets on each pointer move, so a fast drag produces one write after it settles. Persist immediately only when a save must survive an instant reload.
- **ResizeObserver is preferred over window resize.** It catches sidebar expansion/collapse without relying on viewport width.
- **Drag re-renders the workspace shell, not the heavy panels.** `onResize` / `onRectChange` update Workspace state; `ProblemPanel`, `EditorPanel`, and `ChatPanel` are wrapped in `React.memo` because they own their data through Zustand. If a panel gains props, keep them referentially stable or the memo boundary disappears.
- **Keep panel content mounted.** Avoid `key` changes or parent swaps on dock/float; Monaco and chat streaming state are expensive to recreate.
- **Lazy routes.** All page routes are `React.lazy`; `PageLoading` is the Suspense fallback.
- **Floating size is caller-controlled.** `FloatingPanelResizeHandle` reports a clamped rect; the owning layout state decides whether to persist or constrain it further.

---

## Dependencies

### External

| Dependency | Version | Purpose |
|------------|---------|---------|
| `react` / `react-dom` | `^18.3.1` | Components, effects, refs, portals-free rendering |
| `react-router-dom` | `^6.24.0` | Browser router, `Routes`, `NavLink`, `useLocation` |
| `zustand` | `^4.5.4` | App shell, workspace, chat, editor, focus state |
| `lucide-react` | `^0.395.0` | Icons in header/sidebar/toolbar/chrome |
| `axios` | `^1.7.0` | Auth probe; services use it for API calls |
| `nanoid` | `^5.0.7` | Message ids in the header review flow |
| `tailwindcss` | `^3.4.6` | Layout, breakpoints, surfaces, typography |
| `vitest` + `jsdom` | `1.6.1` / `24.1.1` | Component and integration tests |

### Internal contracts

| Module | Used for |
|--------|----------|
| `@/stores/useAppStore` | Theme, mode, active problem, editor/chat state, focus timers |
| `@/services/agentService` | Automatic REVIEW stream and stream commit guards |
| `@/services/leetcodeService` | Run/submit for LeetCode |
| `@/services/localPractice` | Local practice detection |
| `@/services/deepTutorCapabilities` | Workspace-scoped storage keys |
| `@/services/localProgress` | Flush queued local practice records |
| `ProblemPanel` / `EditorPanel` / `ChatPanel` | Panel contents; layout module owns their placement only |

---

## Testing

Run the module tests:

```bash
cd frontend
npm test -- src/components/Layout
```

Type and lint checks:

```bash
cd frontend
npx tsc --noEmit
npm run lint
```

Covered:

- Auth gate: offline + retry, cookie warning, StrictMode request dedupe.
- Narrow workspace: tab persistence, route-state override, chat stays mounted while switching.
- Wide workspace: layout preset application, saved custom preset, reset preserving presets, resizer keyboard adjustment, detach to floating, keyboard move/resize, maximize/restore, viewport-resize clamping, panel content identity, memoized panel render count, reset layout, cross-tab layout sync, embed back.
- Layout storage: versioned envelope round-trip, v1/v2 envelope migration, legacy direct-object migration, malformed JSON fallback.
- FOCUS: chat tab removed, chat panel hidden at narrow and wide widths, detached chat suppressed and restored with its float rect, periodic/pagehide/visibility checkpoints.
- Header: duration formatting, judge capability notes, stale run result rejection, pending submission across navigation, auto-review on/off, streaming review replacement, local Python sample run.
- Guided code: starter template switching, restore confirmation accept/cancel, template-only submit guard, FOCUS keeps the editor editable while disabling assessment submission.
- Guided errors: provider/key rejection exposes the settings repair link.
- Sidebar: single theme control ownership.

Not covered by unit tests:

- Real pointer-drag geometry (covered manually in browser).
- Actual browser layout/overflow at every viewport size.
- localStorage quota/quota-exceeded behavior.
- Conflict resolution when two tabs drag the same panel simultaneously (last-writer-wins, no merge).

`AppShell.test.tsx` mocks the heavy leaf panels and forces `matchMedia` to `(min-width: 1280px)` for the wide test; keep that pattern when adding layout tests.
