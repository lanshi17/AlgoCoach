import { create } from 'zustand'
import type { AgentMode, Problem, ChatMessage, AnimationJob, RunResult, TrainingGoal } from '@/types'

const LANGUAGES = ['rust', 'cpp', 'python3'] as const
const GOALS: TrainingGoal[] = ['contest', 'interview_prep', 'casual']

function readPreference<T extends string>(key: string, values: readonly T[], fallback: T): T {
  try {
    const saved = typeof window === 'undefined' ? null : window.localStorage.getItem(key)
    return values.includes(saved as T) ? saved as T : fallback
  } catch {
    return fallback
  }
}

function initialTheme(): 'light' | 'dark' {
  try {
    const saved = typeof window === 'undefined' ? null : window.localStorage.getItem('algocoach.theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* fall back to the system preference */ }
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function savePreference(key: string, value: string) {
  try { window.localStorage.setItem(key, value) } catch { /* optional preference storage */ }
}

interface AppState {
  // ─── Mode / Focus ───
  mode: AgentMode
  setMode: (m: AgentMode) => void
  focusStartTs: number | null     // when entered FOCUS
  focusElapsedSec: number         // accumulated FOCUS time across retries
  enterFocus: () => void
  exitFocus: () => void
  getFocusDurationSec: () => number

  // ─── Active problem ───
  activeProblem: Problem | null
  setActiveProblem: (p: Problem | null) => void

  // ─── Code editor state ───
  code: string
  codeEdited: boolean
  setCode: (c: string) => void
  lang: 'rust' | 'cpp' | 'python3'
  setLang: (l: 'rust' | 'cpp' | 'python3') => void
  goal: TrainingGoal
  setGoal: (goal: TrainingGoal) => void

  // ─── Chat (agent对话) — locked in FOCUS ───
  messages: ChatMessage[]
  messagesByProblem: Record<string, ChatMessage[]>
  addMessage: (m: ChatMessage) => void
  clearMessages: () => void

  // ─── Animation queue ───
  animations: AnimationJob[]
  activeAnimation: AnimationJob | null
  pushAnimation: (a: AnimationJob) => void
  setActiveAnimation: (a: AnimationJob | null) => void

  // ─── UI ───
  sidebarExpanded: boolean
  toggleSidebar: () => void
  theme: 'light' | 'dark'
  toggleTheme: () => void

  // ─── Submission result ───
  lastSubmission: import('@/types').Submission | null
  setLastSubmission: (s: import('@/types').Submission | null) => void

  // ─── Code execution ───
  testInput: string
  setTestInput: (input: string) => void
  runResult: RunResult | null
  setRunResult: (result: RunResult | null) => void
  runError: string | null
  setRunError: (error: string | null) => void
  runLoading: boolean
  setRunLoading: (loading: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  mode: 'IDLE',
  setMode: m => set({ mode: m }),
  focusStartTs: null,
  focusElapsedSec: 0,
  enterFocus: () => set({ mode: 'FOCUS', focusStartTs: Date.now() }),
  exitFocus: () => {
    const ts = get().focusStartTs
    const elapsed = ts ? Math.floor((Date.now() - ts) / 1000) : 0
    set(state => ({ mode: 'REVIEW', focusStartTs: null, focusElapsedSec: state.focusElapsedSec + elapsed }))
  },
  getFocusDurationSec: () => {
    const { focusStartTs, focusElapsedSec } = get()
    const activeSegment = focusStartTs ? Math.floor((Date.now() - focusStartTs) / 1000) : 0
    return focusElapsedSec + activeSegment
  },

  activeProblem: null,
  messagesByProblem: {},
  setActiveProblem: p => set(state => {
    const previousKey = state.activeProblem?.platformId ?? '__global__'
    const nextKey = p?.platformId ?? '__global__'
    const messagesByProblem = { ...state.messagesByProblem, [previousKey]: state.messages }
    const snippet = p?.codeSnippets.find(item => item.lang === state.lang)?.code ?? ''
    return {
      activeProblem: p,
      messagesByProblem,
      messages: messagesByProblem[nextKey] ?? [],
      code: snippet,
      codeEdited: false,
      mode: p ? 'PREP' : 'IDLE',
      focusStartTs: null,
      focusElapsedSec: 0,
      lastSubmission: null,
      runResult: null,
      runError: null,
      testInput: p?.sampleTestCases.split('\n---\n')[0] ?? '',
    }
  }),

  code: '',
  codeEdited: false,
  setCode: c => set(state => ({ code: c, codeEdited: state.codeEdited || c !== state.code })),
  lang: readPreference('algocoach.language', LANGUAGES, 'rust'),
  setLang: l => set(state => {
    savePreference('algocoach.language', l)
    const snippet = state.activeProblem?.codeSnippets.find(item => item.lang === l)?.code
    return {
      lang: l,
      ...(snippet !== undefined && !state.codeEdited ? { code: snippet } : {}),
    }
  }),
  goal: readPreference('algocoach.goal', GOALS, 'contest'),
  setGoal: goal => {
    savePreference('algocoach.goal', goal)
    set({ goal })
  },

  messages: [],
  addMessage: m => set(state => {
    const key = state.activeProblem?.platformId ?? '__global__'
    const messages = [...state.messages, m]
    return { messages, messagesByProblem: { ...state.messagesByProblem, [key]: messages } }
  }),
  clearMessages: () => set(state => {
    const key = state.activeProblem?.platformId ?? '__global__'
    return { messages: [], messagesByProblem: { ...state.messagesByProblem, [key]: [] } }
  }),

  animations: [],
  activeAnimation: null,
  pushAnimation: a => set(s => ({ animations: [...s.animations, a] })),
  setActiveAnimation: a => set({ activeAnimation: a }),

  sidebarExpanded: false,
  toggleSidebar: () => set(s => ({ sidebarExpanded: !s.sidebarExpanded })),
  theme: initialTheme(),
  toggleTheme: () => set(state => {
    const theme = state.theme === 'dark' ? 'light' : 'dark'
    savePreference('algocoach.theme', theme)
    return { theme }
  }),

  lastSubmission: null,
  setLastSubmission: s => set({ lastSubmission: s }),

  testInput: '',
  setTestInput: input => set({ testInput: input }),
  runResult: null,
  setRunResult: result => set({ runResult: result }),
  runError: null,
  setRunError: error => set({ runError: error }),
  runLoading: false,
  setRunLoading: loading => set({ runLoading: loading }),
}))
