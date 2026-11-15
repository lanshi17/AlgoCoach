import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import Sidebar from './Sidebar'
import Header from './Header'
import ProblemPanel from '@/components/Problem/ProblemPanel'
import EditorPanel from '@/components/Editor/EditorPanel'
import ChatPanel from '@/components/Chat/ChatPanel'
import axios from 'axios'

const CookieSetupPage = lazy(() => import('@/pages/CookieSetupPage'))
const ProgressPage = lazy(() => import('@/pages/ProgressPage'))
const KnowledgeGraphPage = lazy(() => import('@/pages/KnowledgeGraphPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const PlatformLoginPage = lazy(() => import('@/pages/PlatformLoginPage'))

/**
 * Three-column workspace layout (Qwen-platform style):
 *
 *  [sidebar] | [problem desc] | [editor + chat stacked]
 *
 * In FOCUS mode: chat panel is blurred + locked, red bar at top
 */
export default function AppShell() {
  const { theme, mode, activeProblem } = useAppStore()
  const [authState, setAuthState] = useState<'checking' | 'ready' | 'offline'>('checking')

  const checkAuth = useCallback(async () => {
    setAuthState('checking')
    try {
      await axios.get('/api/auth/status')
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

  if (authState === 'checking') {
    return <div className="flex h-full items-center justify-center gap-2 text-sm text-text-muted dark:text-text-dark-muted">
      <Loader2 size={16} className="animate-spin" /> 正在连接 AlgoCoach…
    </div>
  }
  if (authState === 'offline') {
    return <main className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <AlertCircle size={28} className="text-danger" />
      <h1 className="text-base font-semibold text-text-primary dark:text-text-dark-primary">无法连接 Java 网关</h1>
      <p className="text-sm text-text-secondary dark:text-text-dark-secondary">请启动 backend/gateway 后重试。</p>
      <button onClick={() => void checkAuth()} className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
        <RefreshCw size={14} /> 重新连接
      </button>
    </main>
  }
  return (
    <div className="flex h-full w-full overflow-hidden bg-surface dark:bg-surface-dark">
      {/* Focus mode indicator */}
      {mode === 'FOCUS' && <div className="focus-mode-bar" />}

      {/* Left sidebar — icon nav */}
      <Sidebar />

      {/* Main workspace */}
      <div className="flex flex-col flex-1 min-w-0">
        <Suspense fallback={<PageLoading />}><Routes>
          <Route path="/" element={<Navigate to="/workspace" replace />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/knowledge" element={<KnowledgeGraphPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/platforms" element={<PlatformLoginPage />} />
          <Route path="/settings/cookie" element={<CookieSetupPage onDone={() => setAuthState('ready')} />} />
          <Route path="*" element={<Navigate to="/workspace" replace />} />
        </Routes></Suspense>
      </div>
    </div>
  )
}

function PageLoading() {
  return <div className="flex flex-1 items-center justify-center text-sm text-text-muted dark:text-text-dark-muted">正在打开页面…</div>
}

function Workspace() {
  const PANEL_KEY = 'algocoach.workspacePanel'
  const location = useLocation()
  const returnState = location.state as { openPanel?: string } | null
  const [panel, setPanel] = useState<'problem' | 'editor' | 'chat'>(() => {
    if (returnState?.openPanel === 'chat') return 'chat'
    try {
      const saved = window.sessionStorage.getItem(PANEL_KEY)
      if (saved === 'problem' || saved === 'editor' || saved === 'chat') return saved
    } catch { /* keep the problem panel default */ }
    return 'problem'
  })
  const mode = useAppStore(state => state.mode)
  const previousMode = useRef(mode)
  const [isWide, setIsWide] = useState(() => window.matchMedia('(min-width: 1280px)').matches)

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

  return (
    <>
      <Header />
      <nav aria-label="工作区面板" className="flex shrink-0 border-b border-border dark:border-border-dark xl:hidden">
        {([
          ['problem', '题目'], ['editor', '编辑器'], ['chat', 'AI 教练'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={panel === value}
            onClick={() => setPanel(value)}
            className={`flex-1 border-b-2 px-2 py-2 text-sm transition-colors ${panel === value
              ? 'border-accent font-medium text-accent'
              : 'border-transparent text-text-secondary dark:text-text-dark-secondary'}`}>
            {label}
          </button>
        ))}
      </nav>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className={`${panel === 'problem' ? 'flex' : 'hidden'} w-full min-w-0 flex-col overflow-hidden border-r border-border dark:border-border-dark xl:flex xl:w-[var(--problem-w)] xl:shrink-0`}
        >
          {(isWide || panel === 'problem') && <ProblemPanel />}
        </div>
        <div className={`${panel === 'editor' ? 'flex' : 'hidden'} flex-col flex-1 min-w-0 overflow-hidden border-r border-border dark:border-border-dark xl:flex`}>
          {(isWide || panel === 'editor') && <EditorPanel />}
        </div>
        <div className={`${panel === 'chat' ? 'block' : 'hidden'} w-full min-w-0 overflow-hidden xl:block xl:w-[360px] xl:shrink-0`}>
          {(isWide || panel === 'chat') && <ChatPanel />}
        </div>
      </div>
    </>
  )
}
