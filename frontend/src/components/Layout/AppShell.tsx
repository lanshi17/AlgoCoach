import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AlertCircle, ExternalLink, Loader2, PanelTop, RefreshCw, RotateCcw, Save } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import Sidebar from './Sidebar'
import MobileTabBar from './MobileTabBar'
import Header from './Header'
import ColumnResizer from './ColumnResizer'
import FloatingPanelChrome from './FloatingPanelChrome'
import FloatingPanelResizeHandle from './FloatingPanelResizeHandle'
import { clampFloatRect, readFloatRect, type FloatRect } from './floatingPanel'
import { packLayout, unpackLayout } from './layoutStorage'
import { useLayoutStorageSync } from './useLayoutStorageSync'
import ProblemPanel from '@/components/Problem/ProblemPanel'
import EditorPanel from '@/components/Editor/EditorPanel'
import ChatPanel from '@/components/Chat/ChatPanel'
import axios from 'axios'
import { flushLocalPracticeRecords } from '@/services/localProgress'
import { runAutoSync } from '@/services/autoSync'
import { workspaceStorageKey } from '@/services/deepTutorCapabilities'

let authStatusRequest: Promise<unknown> | null = null

function checkAuthStatus(): Promise<unknown> {
  if (!authStatusRequest) {
    // Do not leave the whole workspace on an indefinite spinner when the
    // gateway process is reachable only intermittently.
    authStatusRequest = axios.get('/api/auth/status', { timeout: 8000 }).finally(() => {
      authStatusRequest = null
    })
  }
  return authStatusRequest
}

const ProgressPage = lazy(() => import('@/pages/ProgressPage'))
const LearningSpacePage = lazy(() => import('@/pages/LearningSpacePage'))
const GuidedLearningPage = lazy(() => import('@/pages/GuidedLearningPage'))
const KnowledgeGraphPage = lazy(() => import('@/pages/KnowledgeGraphPage'))
const KnowledgeBasePage = lazy(() => import('@/pages/KnowledgeBasePage'))
const NotebookPage = lazy(() => import('@/pages/NotebookPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const PlatformLoginPage = lazy(() => import('@/pages/PlatformLoginPage'))

// These panels own their state through Zustand. Memoizing them keeps width
// drags and dock/float toggles from re-rendering Monaco or the chat tree.
const MemoProblemPanel = React.memo(ProblemPanel)
const MemoEditorPanel = React.memo(EditorPanel)
const MemoChatPanel = React.memo(ChatPanel)

/**
 * Three-column workspace layout (Qwen-platform style):
 *
 *  [sidebar] | [problem desc] | [editor + chat stacked]
 *
 * In FOCUS mode: chat panel is blurred + locked, red bar at top
 */
export default function AppShell() {
  const { theme, mode, activeProblem } = useAppStore(useShallow(state => ({
    theme: state.theme,
    mode: state.mode,
    activeProblem: state.activeProblem,
  })))
  const [authState, setAuthState] = useState<'checking' | 'ready' | 'offline'>('checking')
  const [cookieInvalid, setCookieInvalid] = useState(false)

  const checkAuth = useCallback(async () => {
    setAuthState('checking')
    try {
      await checkAuthStatus()
      setAuthState('ready')
    } catch {
      setAuthState('offline')
    }
  }, [])

  // Sync dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    if (mode !== 'FOCUS' || !activeProblem) return
    const checkpoint = () => useAppStore.getState().checkpointFocusDuration()
    const checkpointWhenHidden = () => { if (document.hidden) checkpoint() }
    const timer = window.setInterval(checkpoint, 1000)
    window.addEventListener('pagehide', checkpoint)
    document.addEventListener('visibilitychange', checkpointWhenHidden)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('pagehide', checkpoint)
      document.removeEventListener('visibilitychange', checkpointWhenHidden)
    }
  }, [mode, activeProblem, activeProblem?.platform, activeProblem?.platformId])

  useEffect(() => { void checkAuth() }, [checkAuth])

  useEffect(() => {
    void flushLocalPracticeRecords(useAppStore.getState().localPracticeRecords)
  }, [])

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'visible') void runAutoSync().catch(() => { /* Settings shows the last error on demand */ })
    }
    run()
    const timer = window.setInterval(run, 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', run)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', run)
    }
  }, [])

  useEffect(() => {
    const handleCookieInvalid = () => setCookieInvalid(true)
    const handleCookieValid = () => setCookieInvalid(false)
    window.addEventListener('algocoach:cookie-invalid', handleCookieInvalid)
    window.addEventListener('algocoach:cookie-valid', handleCookieValid)
    return () => {
      window.removeEventListener('algocoach:cookie-invalid', handleCookieInvalid)
      window.removeEventListener('algocoach:cookie-valid', handleCookieValid)
    }
  }, [])

  if (authState === 'checking') {
    return <div role="status" aria-live="polite" aria-busy="true" className="flex h-full items-center justify-center gap-2 text-sm text-text-muted dark:text-text-dark-muted">
      <Loader2 size={16} className="animate-spin" /> 正在连接 AlgoCoach…
    </div>
  }
  if (authState === 'offline') {
    return <div className="flex h-full w-full flex-col overflow-hidden bg-canvas dark:bg-[#0B0C0F]">
      <div role="alert" className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2 text-xs text-text-secondary dark:border-border-dark dark:bg-surface-dark-soft dark:text-text-dark-secondary">
        <div className="flex min-w-0 items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span className="truncate"><strong className="font-medium">无法连接 Java 网关。</strong> 题库和判题暂不可用，本地练习仍可用。</span>
        </div>
        <button onClick={() => void checkAuth()} className="inline-flex shrink-0 items-center gap-1.5 text-accent hover:underline">
          <RefreshCw size={13} /> 重新连接
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AppRoutes />
          <MobileTabBar />
        </div>
      </div>
    </div>
  }
  return (
    <div className="flex h-full w-full overflow-hidden bg-canvas dark:bg-[#0B0C0F]">
      {cookieInvalid && (
        <div role="alert" className="fixed bottom-4 left-1/2 z-[100] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-card border border-warning/30 bg-surface px-3 py-2 text-sm text-text-primary dark:bg-surface-dark dark:text-text-dark-primary">
          <span>LeetCode 登录态已失效，题目列表和提交可能无法使用。</span>
          <Link to="/settings/platforms" className="shrink-0 font-medium text-accent hover:underline">重新配置</Link>
          <button type="button" aria-label="关闭 Cookie 失效提示" onClick={() => setCookieInvalid(false)} className="shrink-0 text-text-muted hover:text-text-primary dark:text-text-dark-muted dark:hover:text-text-dark-primary">×</button>
        </div>
      )}

      {/* Focus mode indicator */}
      {mode === 'FOCUS' && <div className="focus-mode-bar" />}

      {/* Left sidebar — icon nav */}
      <Sidebar />

      {/* Main workspace */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppRoutes />
        <MobileTabBar />
      </div>
    </div>
  )
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
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
    </Suspense>
  )
}

function PageLoading() {
  return <div className="flex flex-1 items-center justify-center text-sm text-text-muted dark:text-text-dark-muted">正在打开页面…</div>
}

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

const WORKSPACE_PANELS: ReadonlyArray<{ key: WorkspacePanelKey; label: string }> = [
  { key: 'problem', label: '题目' },
  { key: 'editor', label: '编辑器' },
  { key: 'chat', label: 'AI 教练' },
]

const WORKSPACE_PRESETS = [
  { id: 'balanced', label: '均衡', problemWidth: 420, chatWidth: 360 },
  { id: 'editor', label: '宽编辑器', problemWidth: 300, chatWidth: 300 },
  { id: 'problem', label: '宽题目', problemWidth: 620, chatWidth: 280 },
  { id: 'chat', label: '宽教练', problemWidth: 300, chatWidth: 520 },
] as const

type WorkspacePresetId = typeof WORKSPACE_PRESETS[number]['id']
type WorkspacePresetSelection = WorkspacePresetId | 'saved' | 'custom'

const WORKSPACE_LAYOUT_KEY = 'algocoach.workspaceLayout'
const WORKSPACE_GAP = 12
const WORKSPACE_PADDING_X = 24
const EDITOR_MIN = 200
const PROBLEM_MIN = 280
const PROBLEM_MAX = 720
const CHAT_MIN = 260
const CHAT_MAX = 560
const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayout = {
  problemWidth: 420,
  chatWidth: 360,
  modes: { problem: 'docked', editor: 'docked', chat: 'docked' },
  maximized: { problem: false, editor: false, chat: false },
  customPreset: null,
  floats: {
    problem: { x: 140, y: 120, width: 480, height: 560 },
    editor: { x: 340, y: 80, width: 640, height: 640 },
    chat: { x: 760, y: 120, width: 420, height: 560 },
  },
}

function defaultWorkspaceLayout(): WorkspaceLayout {
  return {
    ...DEFAULT_WORKSPACE_LAYOUT,
    modes: { ...DEFAULT_WORKSPACE_LAYOUT.modes },
    maximized: { ...DEFAULT_WORKSPACE_LAYOUT.maximized },
    floats: {
      problem: { ...DEFAULT_WORKSPACE_LAYOUT.floats.problem },
      editor: { ...DEFAULT_WORKSPACE_LAYOUT.floats.editor },
      chat: { ...DEFAULT_WORKSPACE_LAYOUT.floats.chat },
    },
  }
}

function readWorkspaceLayout(): WorkspaceLayout {
  try {
    const saved = unpackLayout(localStorage.getItem(workspaceStorageKey(WORKSPACE_LAYOUT_KEY))) as Partial<WorkspaceLayout> | null
    if (!saved || typeof saved !== 'object') return DEFAULT_WORKSPACE_LAYOUT
    const modes = saved.modes ?? DEFAULT_WORKSPACE_LAYOUT.modes
    const maximized = saved.maximized ?? DEFAULT_WORKSPACE_LAYOUT.maximized
    const customPreset = saved.customPreset
    const floats = saved.floats ?? DEFAULT_WORKSPACE_LAYOUT.floats
    return {
      problemWidth: typeof saved.problemWidth === 'number' && Number.isFinite(saved.problemWidth)
        ? Math.min(PROBLEM_MAX, Math.max(PROBLEM_MIN, Math.round(saved.problemWidth)))
        : DEFAULT_WORKSPACE_LAYOUT.problemWidth,
      chatWidth: typeof saved.chatWidth === 'number' && Number.isFinite(saved.chatWidth)
        ? Math.min(CHAT_MAX, Math.max(CHAT_MIN, Math.round(saved.chatWidth)))
        : DEFAULT_WORKSPACE_LAYOUT.chatWidth,
      modes: {
        problem: modes.problem === 'floating' ? 'floating' : 'docked',
        editor: modes.editor === 'floating' ? 'floating' : 'docked',
        chat: modes.chat === 'floating' ? 'floating' : 'docked',
      },
      maximized: {
        problem: maximized.problem === true,
        editor: maximized.editor === true,
        chat: maximized.chat === true,
      },
      customPreset: customPreset
        && typeof customPreset === 'object'
        && typeof customPreset.problemWidth === 'number' && Number.isFinite(customPreset.problemWidth)
        && typeof customPreset.chatWidth === 'number' && Number.isFinite(customPreset.chatWidth)
        ? {
          problemWidth: Math.min(PROBLEM_MAX, Math.max(PROBLEM_MIN, Math.round(customPreset.problemWidth))),
          chatWidth: Math.min(CHAT_MAX, Math.max(CHAT_MIN, Math.round(customPreset.chatWidth))),
        }
        : null,
      floats: {
        problem: readFloatRect(floats.problem, DEFAULT_WORKSPACE_LAYOUT.floats.problem),
        editor: readFloatRect(floats.editor, DEFAULT_WORKSPACE_LAYOUT.floats.editor),
        chat: readFloatRect(floats.chat, DEFAULT_WORKSPACE_LAYOUT.floats.chat),
      },
    }
  } catch {
    return DEFAULT_WORKSPACE_LAYOUT
  }
}

function Workspace() {
  const PANEL_KEY = 'algocoach.workspacePanel'
  const location = useLocation()
  const returnState = location.state as { openPanel?: string } | null
  const [panel, setPanel] = useState<WorkspacePanelKey>(() => {
    if (returnState?.openPanel === 'problem' || returnState?.openPanel === 'editor' || returnState?.openPanel === 'chat') return returnState.openPanel
    try {
      const saved = window.sessionStorage.getItem(PANEL_KEY)
      if (saved === 'problem' || saved === 'editor' || saved === 'chat') return saved
    } catch { /* keep the problem panel default */ }
    return 'problem'
  })
  const mode = useAppStore(state => state.mode)
  const previousMode = useRef(mode)
  const [isWide, setIsWide] = useState(() => window.matchMedia('(min-width: 1280px)').matches)
  const [layout, setLayout] = useState<WorkspaceLayout>(readWorkspaceLayout)
  const [workspaceWidth, setWorkspaceWidth] = useState(0)
  const [frontPanel, setFrontPanel] = useState<WorkspacePanelKey>('editor')
  const workspaceRef = useRef<HTMLDivElement>(null)
  const { problemWidth, chatWidth } = layout
  const layoutStorageKey = workspaceStorageKey(WORKSPACE_LAYOUT_KEY)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)')
    const update = () => setIsWide(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    try { window.sessionStorage.setItem(PANEL_KEY, panel) } catch { /* keep the panel in memory */ }
  }, [panel])

  useEffect(() => {
    if (mode === 'FOCUS') setPanel('editor')
    else if (mode === 'REVIEW' && previousMode.current === 'FOCUS') setPanel('chat')
    previousMode.current = mode
  }, [mode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(layoutStorageKey, packLayout(layout)) }
      catch { /* keep the layout usable when storage is blocked */ }
    }, 120)
    return () => window.clearTimeout(timer)
  }, [layout, layoutStorageKey])

  useLayoutStorageSync(layoutStorageKey, newValue => {
    const next = newValue === null ? defaultWorkspaceLayout() : readWorkspaceLayout()
    setLayout(current => JSON.stringify(current) === JSON.stringify(next) ? current : next)
  })

  useEffect(() => {
    const element = workspaceRef.current
    if (!element) return
    const measure = () => setWorkspaceWidth(element.clientWidth || window.innerWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const clampFloats = () => {
      setLayout(current => {
        const floats = {
          problem: clampFloatRect(current.floats.problem),
          editor: clampFloatRect(current.floats.editor),
          chat: clampFloatRect(current.floats.chat),
        }
        return JSON.stringify(floats) === JSON.stringify(current.floats) ? current : { ...current, floats }
      })
    }
    window.addEventListener('resize', clampFloats)
    return () => window.removeEventListener('resize', clampFloats)
  }, [])

  const availableWidth = Math.max(0, (workspaceWidth || window.innerWidth) - WORKSPACE_PADDING_X)
  const usableWidth = Math.max(PROBLEM_MIN + CHAT_MIN + EDITOR_MIN, availableWidth - WORKSPACE_GAP * 2)
  const resizeSpace = Math.max(PROBLEM_MIN + CHAT_MIN, usableWidth - EDITOR_MIN)
  const problemLimit = Math.max(PROBLEM_MIN, Math.min(PROBLEM_MAX, resizeSpace - chatWidth))
  const chatLimit = Math.max(CHAT_MIN, Math.min(CHAT_MAX, resizeSpace - problemWidth))
  const presetsDocked = layout.modes.problem === 'docked' && layout.modes.editor === 'docked' && layout.modes.chat === 'docked'
    && !layout.maximized.problem && !layout.maximized.editor && !layout.maximized.chat
  const activePreset: WorkspacePresetSelection = !presetsDocked
    ? 'custom'
    : layout.customPreset
      && layout.customPreset.problemWidth === problemWidth
      && layout.customPreset.chatWidth === chatWidth
      ? 'saved'
      : WORKSPACE_PRESETS.find(preset => preset.problemWidth === problemWidth && preset.chatWidth === chatWidth)?.id ?? 'custom'

  useEffect(() => {
    if (!isWide) return
    setLayout(current => {
      const maxProblem = Math.max(PROBLEM_MIN, Math.min(PROBLEM_MAX, resizeSpace - current.chatWidth))
      const nextProblem = Math.min(current.problemWidth, maxProblem)
      const maxChat = Math.max(CHAT_MIN, Math.min(CHAT_MAX, resizeSpace - nextProblem))
      const nextChat = Math.min(current.chatWidth, maxChat)
      return nextProblem === current.problemWidth && nextChat === current.chatWidth
        ? current
        : { ...current, problemWidth: nextProblem, chatWidth: nextChat }
    })
  }, [isWide, resizeSpace])

  // FOCUS hides the coach everywhere, including when it was detached. Keeping
  // the wrapper hidden (rather than docking it) preserves ChatPanel state and
  // restores the same float position after focus ends.
  const chatSuppressed = mode === 'FOCUS'
  const isFloating = (key: WorkspacePanelKey) => isWide
    && layout.modes[key] === 'floating'
    && !(key === 'chat' && chatSuppressed)

  const setPanelMode = (key: WorkspacePanelKey, nextMode: WorkspacePanelMode) => {
    setLayout(current => {
      const modes = { ...current.modes, [key]: nextMode }
      const maximized = { ...current.maximized, [key]: false }
      return nextMode === 'floating'
        ? { ...current, modes, maximized, floats: { ...current.floats, [key]: clampFloatRect(current.floats[key]) } }
        : { ...current, modes, maximized }
    })
    setFrontPanel(key)
  }

  const updateFloat = (key: WorkspacePanelKey, rect: FloatRect) => {
    setLayout(current => ({ ...current, floats: { ...current.floats, [key]: clampFloatRect(rect) } }))
  }

  const resetLayout = () => {
    setLayout(current => ({ ...defaultWorkspaceLayout(), customPreset: current.customPreset }))
    setFrontPanel('editor')
  }

  const savePreset = () => {
    setLayout(current => ({ ...current, customPreset: { problemWidth: current.problemWidth, chatWidth: current.chatWidth } }))
  }

  const applyPreset = (id: WorkspacePresetId | 'saved') => {
    setLayout(current => {
      const preset = id === 'saved' ? current.customPreset : WORKSPACE_PRESETS.find(item => item.id === id)
      if (!preset) return current
      return {
        ...current,
        problemWidth: preset.problemWidth,
        chatWidth: preset.chatWidth,
        modes: { problem: 'docked', editor: 'docked', chat: 'docked' },
        maximized: { problem: false, editor: false, chat: false },
      }
    })
    setFrontPanel('editor')
  }

  const panelClass = (key: WorkspacePanelKey, dockedWidthClass: string) => {
    if (isFloating(key)) {
      return 'fixed flex min-h-0 min-w-0 flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-2xl dark:border-border-dark dark:bg-surface-dark'
    }
    // FOCUS must stay hidden at xl too; `xl:flex` is only for the normal tab
    // switching below the wide breakpoint.
    const visibility = key === 'chat' && chatSuppressed
      ? 'hidden'
      : `${panel === key ? 'flex' : 'hidden'} xl:flex`
    return `${visibility} relative w-full min-h-0 min-w-0 flex-col overflow-visible bg-surface xl:rounded-card xl:border xl:border-border xl:shadow-none dark:bg-surface-dark ${dockedWidthClass}`
  }

  const panelStyle = (key: WorkspacePanelKey): React.CSSProperties | undefined => {
    if (!isFloating(key)) return undefined
    const zIndex = frontPanel === key ? 92 : 91
    if (layout.maximized[key]) return { left: 8, top: 8, right: 8, bottom: 8, width: 'auto', height: 'auto', zIndex }
    const rect = layout.floats[key]
    return { left: rect.x, top: rect.y, width: rect.width, height: rect.height, zIndex }
  }

  const toggleMaximize = (key: WorkspacePanelKey) => {
    setLayout(current => ({ ...current, maximized: { ...current.maximized, [key]: !current.maximized[key] } }))
    setFrontPanel(key)
  }

  const renderPlaceholder = (key: WorkspacePanelKey, label: string) => {
    if (!isFloating(key)) return null
    const widthClass = key === 'editor'
      ? 'flex-1'
      : key === 'problem' ? 'xl:w-[var(--problem-w)] xl:shrink-0' : 'xl:w-[var(--chat-w)] xl:shrink-0'
    return (
      <div
        key={`placeholder-${key}`}
        aria-label={`${label}已独立为浮窗`}
        className={`hidden min-h-0 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border bg-surface/40 text-xs text-text-muted xl:flex dark:border-border-dark dark:bg-surface-dark/40 dark:text-text-dark-muted ${widthClass}`}
      >
        <span>{label}已独立为浮窗</span>
        <button type="button" onClick={() => setPanelMode(key, 'docked')} className="rounded-full border border-border px-2.5 py-1 text-[11px] transition-colors hover:border-accent/60 hover:text-accent dark:border-border-dark">
          嵌入布局
        </button>
      </div>
    )
  }

  const renderChrome = (key: WorkspacePanelKey, title: string) => isFloating(key)
    ? <FloatingPanelChrome title={title} rect={layout.floats[key]} onRectChange={rect => updateFloat(key, rect)} onDock={() => setPanelMode(key, 'docked')} onActivate={() => setFrontPanel(key)} maximized={layout.maximized[key]} onToggleMaximize={() => toggleMaximize(key)} />
    : null

  return (
    <>
      <Header />
      <nav aria-label="工作区面板" className="flex shrink-0 gap-1 bg-canvas px-3 py-2 dark:bg-[#0B0C0F] xl:hidden">
        {([
          ['problem', '题目'], ['editor', '编辑器'], ...(mode === 'FOCUS' ? [] : [['chat', 'AI 教练']] as const),
        ] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={panel === value}
            onClick={() => setPanel(value)}
            className={`flex-1 rounded-full px-2 py-2 text-sm tracking-cn transition-[background-color,color,font-weight] ${panel === value
              ? 'bg-border font-medium text-accent dark:bg-surface-dark-muted'
              : 'text-text-secondary hover:bg-surface-muted dark:text-text-dark-secondary dark:hover:bg-surface-dark-muted'}`}>
            {label}
          </button>
        ))}
      </nav>
      <div aria-label="面板布局" className="hidden shrink-0 items-center gap-2 bg-canvas px-3 py-1.5 text-xs text-text-muted dark:bg-[#0B0C0F] dark:text-text-dark-muted xl:flex">
        <span className="mr-auto">拖拽分隔线调整宽度；独立后浮窗可拖动</span>
        <select
          aria-label="布局预设"
          value={activePreset}
          title="选择布局预设；手动调整后显示自定义"
          onChange={event => {
            const value = event.target.value
            if (value !== 'custom') applyPreset(value as WorkspacePresetId | 'saved')
          }}
          className="rounded-full border border-border bg-canvas px-2.5 py-1 text-xs text-text-secondary outline-none transition-colors hover:border-accent/60 dark:border-border-dark dark:bg-[#0B0C0F] dark:text-text-dark-secondary"
        >
          {WORKSPACE_PRESETS.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
          {layout.customPreset && <option value="saved">我的布局</option>}
          <option value="custom">自定义</option>
        </select>
        {WORKSPACE_PANELS.filter(item => !(item.key === 'chat' && chatSuppressed)).map(item => {
          const floating = isFloating(item.key)
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={floating}
              aria-label={`${item.label}：${floating ? '嵌入布局' : '独立为浮窗'}`}
              title={floating ? `将${item.label}嵌入布局` : `将${item.label}独立为浮窗`}
              onClick={() => setPanelMode(item.key, floating ? 'docked' : 'floating')}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${floating
                ? 'border-accent/30 bg-accent/10 text-accent'
                : 'border-border text-text-secondary hover:border-accent/60 hover:text-accent dark:border-border-dark dark:text-text-dark-secondary'}`}
            >
              {floating ? <PanelTop size={13} /> : <ExternalLink size={13} />}
              <span>{item.label}</span>
              <span className="text-[10px] opacity-70">{floating ? '嵌入' : '独立'}</span>
            </button>
          )
        })}
        <button
          type="button"
          aria-label="保存当前布局为我的布局"
          title="把当前题目/教练栏宽度保存为「我的布局」"
          onClick={savePreset}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-accent/60 hover:text-accent dark:border-border-dark dark:text-text-dark-secondary"
        >
          <Save size={13} />
          <span>保存</span>
        </button>
        <button
          type="button"
          aria-label="重置面板布局"
          title="重置宽度、停靠状态和浮窗位置"
          onClick={resetLayout}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-accent/60 hover:text-accent dark:border-border-dark dark:text-text-dark-secondary"
        >
          <RotateCcw size={13} />
          <span>重置</span>
        </button>
      </div>
      <div
        ref={workspaceRef}
        className="flex flex-1 min-h-0 gap-3 overflow-visible bg-canvas px-3 pb-3 dark:bg-[#0B0C0F] xl:gap-3"
        style={{ '--problem-w': `${problemWidth}px`, '--chat-w': `${chatWidth}px` } as React.CSSProperties}
      >
        {renderPlaceholder('problem', '题目')}
        <div
          key="panel-problem"
          data-workspace-panel="problem"
          role={isFloating('problem') ? 'dialog' : undefined}
          aria-label={isFloating('problem') ? '题目浮窗' : undefined}
          className={panelClass('problem', 'xl:w-[var(--problem-w)] xl:shrink-0')}
          style={panelStyle('problem')}
          onPointerDownCapture={isFloating('problem') ? () => setFrontPanel('problem') : undefined}
        >
          {renderChrome('problem', '题目')}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card">
            {(isWide || panel === 'problem') && <MemoProblemPanel />}
          </div>
          {isFloating('problem') && !layout.maximized.problem && <FloatingPanelResizeHandle label="调整题目浮窗大小" rect={layout.floats.problem} onResize={rect => updateFloat('problem', rect)} />}
          {isWide && !isFloating('problem') && <ColumnResizer variant="workspace" side="right" width={problemWidth} min={PROBLEM_MIN} max={problemLimit} defaultWidth={DEFAULT_WORKSPACE_LAYOUT.problemWidth} label="调整题目宽度" onResize={width => setLayout(current => ({ ...current, problemWidth: width }))} />}
        </div>

        {renderPlaceholder('editor', '编辑器')}
        <div
          key="panel-editor"
          data-workspace-panel="editor"
          role={isFloating('editor') ? 'dialog' : undefined}
          aria-label={isFloating('editor') ? '编辑器浮窗' : undefined}
          className={panelClass('editor', 'xl:flex-1')}
          style={panelStyle('editor')}
          onPointerDownCapture={isFloating('editor') ? () => setFrontPanel('editor') : undefined}
        >
          {renderChrome('editor', '编辑器')}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card">
            {(isWide || panel === 'editor') && <MemoEditorPanel />}
          </div>
          {isFloating('editor') && !layout.maximized.editor && <FloatingPanelResizeHandle label="调整编辑器浮窗大小" rect={layout.floats.editor} onResize={rect => updateFloat('editor', rect)} />}
        </div>

        {renderPlaceholder('chat', 'AI 教练')}
        <div
          key="panel-chat"
          data-workspace-panel="chat"
          role={isFloating('chat') ? 'dialog' : undefined}
          aria-label={isFloating('chat') ? 'AI 教练浮窗' : undefined}
          className={panelClass('chat', 'xl:w-[var(--chat-w)] xl:shrink-0')}
          style={panelStyle('chat')}
          onPointerDownCapture={isFloating('chat') ? () => setFrontPanel('chat') : undefined}
        >
          {renderChrome('chat', 'AI 教练')}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card">
            {/* Keep the chat mounted on narrow screens while it is hidden. A
                pending coach reply must survive a panel switch; ChatPanel
                already aborts requests when its problem or mode changes. */}
            <MemoChatPanel />
          </div>
          {isFloating('chat') && !layout.maximized.chat && <FloatingPanelResizeHandle label="调整教练浮窗大小" rect={layout.floats.chat} onResize={rect => updateFloat('chat', rect)} />}
          {isWide && !isFloating('chat') && <ColumnResizer variant="workspace" side="left" width={chatWidth} min={CHAT_MIN} max={chatLimit} defaultWidth={DEFAULT_WORKSPACE_LAYOUT.chatWidth} label="调整对话宽度" onResize={width => setLayout(current => ({ ...current, chatWidth: width }))} />}
        </div>
      </div>
    </>
  )
}
