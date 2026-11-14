import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import Sidebar from './Sidebar'
import Header from './Header'
import ProblemPanel from '@/components/Problem/ProblemPanel'
import EditorPanel from '@/components/Editor/EditorPanel'
import ChatPanel from '@/components/Chat/ChatPanel'
import { leetcodeService } from '@/services/leetcodeService'

const CookieSetupPage = lazy(() => import('@/pages/CookieSetupPage'))
const ProgressPage = lazy(() => import('@/pages/ProgressPage'))
const KnowledgeGraphPage = lazy(() => import('@/pages/KnowledgeGraphPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

/**
 * Three-column workspace layout (Qwen-platform style):
 *
 *  [sidebar] | [problem desc] | [editor + chat stacked]
 *
 * In FOCUS mode: chat panel is blurred + locked, red bar at top
 */
export default function AppShell() {
  const { theme, mode } = useAppStore()
  const [authState, setAuthState] = useState<'checking' | 'ready' | 'setup' | 'offline'>('checking')

  const checkAuth = useCallback(async () => {
    setAuthState('checking')
    try {
      setAuthState(await leetcodeService.authStatus() ? 'ready' : 'setup')
    } catch {
      setAuthState('offline')
    }
  }, [])

  // Sync dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => { void checkAuth() }, [checkAuth])

  useEffect(() => {
    const handleInvalidCookie = () => setAuthState('setup')
    window.addEventListener('algocoach:cookie-invalid', handleInvalidCookie)
    return () => window.removeEventListener('algocoach:cookie-invalid', handleInvalidCookie)
  }, [])

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
  if (authState === 'setup') {
    return <Suspense fallback={<PageLoading />}><CookieSetupPage onDone={() => setAuthState('ready')} /></Suspense>
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
  return (
    <>
      <Header />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className="flex-shrink-0 overflow-hidden border-r border-border dark:border-border-dark"
          style={{ width: 'var(--problem-w)' }}
        >
          <ProblemPanel />
        </div>
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-border dark:border-border-dark">
          <EditorPanel />
        </div>
        <div className="flex-shrink-0 overflow-hidden" style={{ width: '360px' }}>
          <ChatPanel />
        </div>
      </div>
    </>
  )
}
