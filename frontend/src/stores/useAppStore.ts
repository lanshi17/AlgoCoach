import { create } from 'zustand'
import type { AgentMode, Problem, ChatMessage, AnimationJob, RunResult, TrainingGoal, TrainingPhase, ModelProviderConfig, CodeLanguage, CoachPrefs } from '@/types'
import { CODE_LANGUAGES } from '@/services/languages'
import { appendLocalPracticeRecord, readLocalPracticeRecords, type LocalPracticeRecord } from '@/services/localProgress'

const GOALS: TrainingGoal[] = ['contest', 'interview_prep', 'casual']
const DRAFTS_KEY = 'algocoach.problemDrafts'
const ACTIVE_PROBLEM_KEY = 'algocoach.activeProblem'
const CHAT_DRAFTS_KEY = 'algocoach.chatDrafts'
const CHAT_PHASES_KEY = 'algocoach.chatPhases'
const TIME_LIMITS_KEY = 'algocoach.problemTimeLimits'
const COACH_PREFS_KEY = 'algocoach.coachPrefs'
const FOCUS_TIMES_KEY = 'algocoach.problemFocusElapsed'
const PROVIDER_API_KEY_PREFIX = 'algocoach.provider.apiKey.'

function providerApiKeyStorageKey(providerId: string): string {
  return `${PROVIDER_API_KEY_PREFIX}${encodeURIComponent(providerId || 'custom')}`
}

/** Provider credentials are session-only and scoped to the selected preset. */
export function readProviderApiKey(providerId: string): string {
  try {
    return window.sessionStorage.getItem(providerApiKeyStorageKey(providerId)) ?? ''
  } catch {
    return ''
  }
}

interface ProblemDraft {
  code: string
  codeEdited: boolean
  testInput: string
  lang: CodeLanguage
  codes?: Partial<Record<CodeLanguage, { code: string; codeEdited: boolean }>>
}

function problemKey(problem: Problem): string {
  return `${problem.platform}:${problem.platformId}`
}

function readActiveProblem(): Problem | null {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(ACTIVE_PROBLEM_KEY) ?? 'null')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const problem = value as Partial<Problem>
    if (typeof problem.platform !== 'string' || typeof problem.platformId !== 'string'
      || typeof problem.title !== 'string' || typeof problem.difficulty !== 'string'
      || typeof problem.contentHtml !== 'string' || !Array.isArray(problem.topics)
      || !Array.isArray(problem.codeSnippets) || typeof problem.sampleTestCases !== 'string') return null
    return problem as Problem
  } catch { return null }
}

function persistActiveProblem(problem: Problem | null) {
  try {
    if (problem) window.sessionStorage.setItem(ACTIVE_PROBLEM_KEY, JSON.stringify(problem))
    else window.sessionStorage.removeItem(ACTIVE_PROBLEM_KEY)
  } catch { /* keep the selection in memory */ }
}

function readDrafts(): Record<string, ProblemDraft> {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(DRAFTS_KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([, item]) => {
      if (!item || typeof item !== 'object') return false
      const draft = item as Partial<ProblemDraft>
      return typeof draft.code === 'string' && typeof draft.codeEdited === 'boolean'
        && typeof draft.testInput === 'string' && CODE_LANGUAGES.includes(draft.lang as CodeLanguage)
    }).map(([key, item]) => {
      const draft = item as ProblemDraft
      const codes = Object.fromEntries(Object.entries(draft.codes ?? {}).filter(([lang, entry]) =>
        CODE_LANGUAGES.includes(lang as CodeLanguage) && entry && typeof entry.code === 'string'
        && typeof entry.codeEdited === 'boolean'))
      return [key, { ...draft, codes }]
    })) as Record<string, ProblemDraft>
  } catch { return {} }
}

function readProblemTimeLimits(): Record<string, number> {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(TIME_LIMITS_KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([, seconds]) =>
      Number.isSafeInteger(seconds) && Number(seconds) >= 0)) as Record<string, number>
  } catch { return {} }
}

function readChatDrafts(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(CHAT_DRAFTS_KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([, draft]) => typeof draft === 'string'))
  } catch { return {} }
}

function persistChatDrafts(drafts: Record<string, string>) {
  try { window.sessionStorage.setItem(CHAT_DRAFTS_KEY, JSON.stringify(drafts)) } catch { /* keep in memory */ }
}

const TRAINING_PHASES: readonly TrainingPhase[] = [
  'auto', 'virtual_contest', 'topic_drill', 'attempt', 'hint', 'review', 'upsolve',
]

function readChatPhases(): Record<string, TrainingPhase> {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(CHAT_PHASES_KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([, phase]) =>
      TRAINING_PHASES.includes(phase as TrainingPhase))) as Record<string, TrainingPhase>
  } catch { return {} }
}

const DEFAULT_COACH_PREFS: CoachPrefs = {
  autoReview: true,
  showThinking: true,
  animations: true,
  coachStyle: 'auto',
}

function readCoachPrefs(): CoachPrefs {
  try {
    const value = JSON.parse(window.localStorage.getItem(COACH_PREFS_KEY) ?? 'null') as Partial<CoachPrefs> | null
    if (!value || typeof value !== 'object') return DEFAULT_COACH_PREFS
    return {
      autoReview: typeof value.autoReview === 'boolean' ? value.autoReview : true,
      showThinking: typeof value.showThinking === 'boolean' ? value.showThinking : true,
      animations: typeof value.animations === 'boolean' ? value.animations : true,
      coachStyle: value.coachStyle === 'socratic' || value.coachStyle === 'direct' ? value.coachStyle : 'auto',
    }
  } catch { return DEFAULT_COACH_PREFS }
}

function persistCoachPrefs(prefs: CoachPrefs) {
  try { window.localStorage.setItem(COACH_PREFS_KEY, JSON.stringify(prefs)) } catch { /* keep in memory */ }
}

function persistChatPhases(phases: Record<string, TrainingPhase>) {
  try { window.sessionStorage.setItem(CHAT_PHASES_KEY, JSON.stringify(phases)) } catch { /* keep in memory */ }
}

function persistProblemTimeLimits(limits: Record<string, number>) {
  try { window.sessionStorage.setItem(TIME_LIMITS_KEY, JSON.stringify(limits)) } catch { /* keep in memory */ }
}

function readProblemFocusTimes(): Record<string, number> {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(FOCUS_TIMES_KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter(([, seconds]) =>
      Number.isSafeInteger(seconds) && Number(seconds) >= 0)) as Record<string, number>
  } catch { return {} }
}

function persistProblemFocusTimes(times: Record<string, number>) {
  try { window.sessionStorage.setItem(FOCUS_TIMES_KEY, JSON.stringify(times)) } catch { /* keep in memory */ }
}

function saveDraft(
  drafts: Record<string, ProblemDraft>, problem: Problem | null, draft: ProblemDraft,
): Record<string, ProblemDraft> {
  if (!problem) return drafts
  const key = problemKey(problem)
  const previous = drafts[key]
  const codes = { ...previous?.codes }
  if (previous) codes[previous.lang] = { code: previous.code, codeEdited: previous.codeEdited }
  codes[draft.lang] = { code: draft.code, codeEdited: draft.codeEdited }
  const next = { ...drafts, [key]: { ...draft, codes } }
  try { window.sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(next)) } catch { /* keep in memory */ }
  return next
}

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

const DEFAULT_PROVIDER: ModelProviderConfig = {
  id: 'anthropic', name: 'Anthropic', protocol: 'anthropic',
  baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-5', apiKey: '',
}

const INITIAL_ACTIVE_PROBLEM = readActiveProblem()
const INITIAL_DRAFTS = readDrafts()
const INITIAL_PROBLEM_FOCUS_TIMES = readProblemFocusTimes()
const INITIAL_LANGUAGE = readPreference('algocoach.language', CODE_LANGUAGES, 'rust')
const INITIAL_FOCUS_ELAPSED_SEC = INITIAL_ACTIVE_PROBLEM
  ? INITIAL_PROBLEM_FOCUS_TIMES[problemKey(INITIAL_ACTIVE_PROBLEM)] ?? 0
  : 0
const INITIAL_DRAFT = INITIAL_ACTIVE_PROBLEM
  ? INITIAL_DRAFTS[problemKey(INITIAL_ACTIVE_PROBLEM)]
  : undefined
const INITIAL_CODE = INITIAL_DRAFT?.code
  ?? INITIAL_ACTIVE_PROBLEM?.codeSnippets.find(item => item.lang === INITIAL_LANGUAGE)?.code
  ?? ''
const INITIAL_TEST_INPUT = INITIAL_DRAFT?.testInput
  ?? INITIAL_ACTIVE_PROBLEM?.sampleTestCases.split('\n---\n')[0]
  ?? ''
const INITIAL_LOCAL_PRACTICE_RECORDS = readLocalPracticeRecords()

function initialProvider(): ModelProviderConfig {
  try {
    const saved = window.localStorage.getItem('algocoach.provider')
    if (!saved) {
      const apiKey = readProviderApiKey(DEFAULT_PROVIDER.id)
      const provider = { ...DEFAULT_PROVIDER, apiKey }
      if (apiKey) saveProvider(provider)
      return provider
    }

    const metadata = JSON.parse(saved) as Partial<ModelProviderConfig>
    const providerId = typeof metadata.id === 'string' && metadata.id ? metadata.id : DEFAULT_PROVIDER.id
    const apiKey = readProviderApiKey(providerId)
    const provider = { ...DEFAULT_PROVIDER, ...metadata, apiKey } as ModelProviderConfig
    return provider
  } catch { return DEFAULT_PROVIDER }
}

function saveProvider(provider: ModelProviderConfig) {
  try {
    const { apiKey, ...metadata } = provider
    window.localStorage.setItem('algocoach.provider', JSON.stringify(metadata))
    if (apiKey) {
      window.sessionStorage.setItem(providerApiKeyStorageKey(provider.id), apiKey)
    } else {
      window.sessionStorage.removeItem(providerApiKeyStorageKey(provider.id))
    }
  } catch { /* optional provider preference storage */ }
}

interface AppState {
  // ─── Mode / Focus ───
  mode: AgentMode
  setMode: (m: AgentMode) => void
  focusStartTs: number | null     // when entered FOCUS
  focusElapsedSec: number         // accumulated FOCUS time across retries
  enterFocus: () => void
  exitFocus: () => void
  checkpointFocusDuration: (nowMs?: number) => void
  getFocusDurationSec: (nowMs?: number) => number

  // ─── Active problem ───
  activeProblem: Problem | null
  problemDrafts: Record<string, ProblemDraft>
  setActiveProblem: (p: Problem | null) => void
  refreshActiveProblem: (p: Problem) => void
  problemTimeLimits: Record<string, number>
  setProblemTimeLimitMinutes: (minutes: string) => void
  problemFocusElapsed: Record<string, number>

  // ─── Code editor state ───
  code: string
  codeEdited: boolean
  setCode: (c: string) => void
  lang: CodeLanguage
  setLang: (l: CodeLanguage) => void
  goal: TrainingGoal
  setGoal: (goal: TrainingGoal) => void
  provider: ModelProviderConfig
  setProvider: (provider: ModelProviderConfig) => void
  coachPrefs: CoachPrefs
  setCoachPrefs: (patch: Partial<CoachPrefs>) => void

  // ─── Chat (agent对话) — locked in FOCUS ───
  messages: ChatMessage[]
  messagesByProblem: Record<string, ChatMessage[]>
  addMessage: (m: ChatMessage) => void
  clearMessages: () => void
  chatDrafts: Record<string, string>
  setChatDraft: (draft: string) => void
  chatPhases: Record<string, TrainingPhase>
  setChatPhase: (phase: TrainingPhase) => void

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
  submitLoading: boolean
  setSubmitLoading: (loading: boolean) => void
  submitError: string | null
  setSubmitError: (error: string | null) => void

  // ─── Code execution ───
  testInput: string
  setTestInput: (input: string) => void
  runResult: RunResult | null
  setRunResult: (result: RunResult | null) => void
  runError: string | null
  setRunError: (error: string | null) => void
  runLoading: boolean
  setRunLoading: (loading: boolean) => void

  // ─── Local practice ledger ───
  localPracticeRecords: LocalPracticeRecord[]
}

export const useAppStore = create<AppState>((set, get) => ({
  mode: INITIAL_ACTIVE_PROBLEM ? 'PREP' : 'IDLE',
  setMode: m => set({ mode: m }),
  focusStartTs: null,
  focusElapsedSec: INITIAL_FOCUS_ELAPSED_SEC,
  enterFocus: () => set({ mode: 'FOCUS', focusStartTs: Date.now() }),
  exitFocus: () => {
    const { activeProblem, focusStartTs } = get()
    const ts = focusStartTs
    const elapsed = ts ? Math.floor((Date.now() - ts) / 1000) : 0
    set(state => {
      const focusElapsedSec = state.focusElapsedSec + elapsed
      if (!activeProblem) return { mode: 'REVIEW', focusStartTs: null, focusElapsedSec }
      const localPracticeRecords = appendLocalPracticeRecord({
        problemId: problemKey(activeProblem),
        title: activeProblem.titleCn ?? activeProblem.title,
        topics: activeProblem.topics,
        durationSec: focusElapsedSec,
        codeLength: state.code.length,
        endedAt: new Date().toISOString(),
      })
      const problemFocusElapsed = {
        ...state.problemFocusElapsed,
        [problemKey(activeProblem)]: focusElapsedSec,
      }
      persistProblemFocusTimes(problemFocusElapsed)
      return { mode: 'REVIEW', focusStartTs: null, focusElapsedSec, problemFocusElapsed, localPracticeRecords }
    })
  },
  checkpointFocusDuration: (nowMs = Date.now()) => {
    const { activeProblem, focusStartTs, focusElapsedSec, problemFocusElapsed } = get()
    if (!activeProblem || focusStartTs === null) return
    const key = problemKey(activeProblem)
    const elapsed = focusElapsedSec + Math.max(0, Math.floor((nowMs - focusStartTs) / 1000))
    if (problemFocusElapsed[key] === elapsed) return
    const next = { ...problemFocusElapsed, [key]: elapsed }
    persistProblemFocusTimes(next)
  },
  getFocusDurationSec: (nowMs = Date.now()) => {
    const { focusStartTs, focusElapsedSec } = get()
    const activeSegment = focusStartTs
      ? Math.max(0, Math.floor((nowMs - focusStartTs) / 1000))
      : 0
    return focusElapsedSec + activeSegment
  },

  activeProblem: INITIAL_ACTIVE_PROBLEM,
  problemDrafts: INITIAL_DRAFTS,
  problemTimeLimits: readProblemTimeLimits(),
  problemFocusElapsed: INITIAL_PROBLEM_FOCUS_TIMES,
  setProblemTimeLimitMinutes: minutes => set(state => {
    const key = state.activeProblem ? problemKey(state.activeProblem) : '__global__'
    if (minutes === '') {
      const problemTimeLimits = { ...state.problemTimeLimits }
      delete problemTimeLimits[key]
      persistProblemTimeLimits(problemTimeLimits)
      return { problemTimeLimits }
    }
    const value = Number(minutes)
    if (!Number.isSafeInteger(value) || value < 0 || value > Math.floor(Number.MAX_SAFE_INTEGER / 60)) return {}
    const problemTimeLimits = { ...state.problemTimeLimits, [key]: value * 60 }
    persistProblemTimeLimits(problemTimeLimits)
    return { problemTimeLimits }
  }),
  messagesByProblem: {},
  setActiveProblem: p => set(state => {
    persistActiveProblem(p)
    const previousKey = state.activeProblem ? problemKey(state.activeProblem) : '__global__'
    const nextKey = p ? problemKey(p) : '__global__'
    const sameProblem = previousKey === nextKey
    const messagesByProblem = sameProblem
      ? state.messagesByProblem
      : { ...state.messagesByProblem, [previousKey]: state.messages }
    const problemFocusElapsed = state.activeProblem && !sameProblem
      ? { ...state.problemFocusElapsed, [previousKey]: state.getFocusDurationSec() }
      : state.problemFocusElapsed
    if (state.activeProblem && !sameProblem) persistProblemFocusTimes(problemFocusElapsed)
    const problemDrafts = saveDraft(state.problemDrafts, state.activeProblem, {
        code: state.code,
        codeEdited: state.codeEdited,
        testInput: state.testInput,
        lang: state.lang,
    })
    const draft = p ? problemDrafts[problemKey(p)] : undefined
    const lang = draft?.lang ?? state.lang
    const snippet = p?.codeSnippets.find(item => item.lang === lang)?.code ?? ''
    return {
      activeProblem: p,
      problemDrafts,
      messagesByProblem,
      messages: messagesByProblem[nextKey] ?? [],
      code: draft?.code ?? snippet,
      codeEdited: draft?.codeEdited ?? false,
      lang,
      mode: p ? 'PREP' : 'IDLE',
      focusStartTs: null,
      focusElapsedSec: p ? problemFocusElapsed[nextKey] ?? 0 : 0,
      problemFocusElapsed,
      lastSubmission: null,
      submitError: null,
      runResult: null,
      runError: null,
      testInput: draft?.testInput ?? p?.sampleTestCases.split('\n---\n')[0] ?? '',
    }
  }),
  refreshActiveProblem: p => set(state => {
    if (!state.activeProblem || problemKey(state.activeProblem) !== problemKey(p)) return {}
    persistActiveProblem(p)
    // A background metadata refresh must not behave like an explicit problem
    // selection: preserve FOCUS, its timer, drafts and chat context.
    return { activeProblem: p }
  }),

  code: INITIAL_CODE,
  codeEdited: INITIAL_DRAFT?.codeEdited ?? false,
  setCode: c => set(state => {
    const codeEdited = state.codeEdited || c !== state.code
    return {
      code: c, codeEdited,
      ...(c !== state.code ? { runResult: null, runError: null } : {}),
      problemDrafts: saveDraft(state.problemDrafts, state.activeProblem, {
        code: c, codeEdited, testInput: state.testInput, lang: state.lang,
      }),
    }
  }),
  lang: INITIAL_LANGUAGE,
  setLang: l => set(state => {
    if (state.mode === 'FOCUS') return {}
    savePreference('algocoach.language', l)
    if (l === state.lang) return {}
    if (!state.activeProblem) return { lang: l }
    const problemDrafts = saveDraft(state.problemDrafts, state.activeProblem, {
      code: state.code, codeEdited: state.codeEdited, testInput: state.testInput, lang: state.lang,
    })
    const saved = problemDrafts[problemKey(state.activeProblem)]?.codes?.[l]
    const snippet = state.activeProblem?.codeSnippets.find(item => item.lang === l)?.code
    const code = saved?.code ?? snippet ?? ''
    const codeEdited = saved?.codeEdited ?? false
    return {
      lang: l,
      code,
      codeEdited,
      runResult: null,
      runError: null,
      problemDrafts: saveDraft(problemDrafts, state.activeProblem, {
        code, codeEdited, testInput: state.testInput, lang: l,
      }),
    }
  }),
  goal: readPreference('algocoach.goal', GOALS, 'contest'),
  setGoal: goal => {
    savePreference('algocoach.goal', goal)
    set({ goal })
  },
  provider: initialProvider(),
  setProvider: provider => {
    saveProvider(provider)
    set({ provider })
  },
  coachPrefs: readCoachPrefs(),
  setCoachPrefs: patch => set(state => {
    const coachPrefs = { ...state.coachPrefs, ...patch }
    persistCoachPrefs(coachPrefs)
    return { coachPrefs }
  }),

  messages: [],
  chatDrafts: readChatDrafts(),
  setChatDraft: draft => set(state => {
    const key = state.activeProblem ? problemKey(state.activeProblem) : '__global__'
    const chatDrafts = { ...state.chatDrafts }
    if (draft) chatDrafts[key] = draft
    else delete chatDrafts[key]
    persistChatDrafts(chatDrafts)
    return { chatDrafts }
  }),
  chatPhases: readChatPhases(),
  setChatPhase: phase => set(state => {
    const key = state.activeProblem ? problemKey(state.activeProblem) : '__global__'
    const chatPhases = { ...state.chatPhases }
    if (phase === 'auto') delete chatPhases[key]
    else chatPhases[key] = phase
    persistChatPhases(chatPhases)
    return { chatPhases }
  }),
  addMessage: m => set(state => {
    const key = state.activeProblem ? problemKey(state.activeProblem) : '__global__'
    const messages = [...state.messages, m]
    return { messages, messagesByProblem: { ...state.messagesByProblem, [key]: messages } }
  }),
  clearMessages: () => set(state => {
    const key = state.activeProblem ? problemKey(state.activeProblem) : '__global__'
    return { messages: [], messagesByProblem: { ...state.messagesByProblem, [key]: [] } }
  }),

  animations: [],
  activeAnimation: null,
  pushAnimation: a => set(s => ({ animations: [...s.animations, a] })),
  setActiveAnimation: a => set({ activeAnimation: a }),

  sidebarExpanded: true,
  toggleSidebar: () => set(s => ({ sidebarExpanded: !s.sidebarExpanded })),
  theme: initialTheme(),
  toggleTheme: () => set(state => {
    const theme = state.theme === 'dark' ? 'light' : 'dark'
    savePreference('algocoach.theme', theme)
    return { theme }
  }),

  lastSubmission: null,
  setLastSubmission: s => set({ lastSubmission: s }),
  submitLoading: false,
  setSubmitLoading: loading => set({ submitLoading: loading }),
  submitError: null,
  setSubmitError: error => set({ submitError: error }),

  testInput: INITIAL_TEST_INPUT,
  setTestInput: input => set(state => ({
    testInput: input,
    ...(input !== state.testInput ? { runResult: null, runError: null } : {}),
    problemDrafts: saveDraft(state.problemDrafts, state.activeProblem, {
      code: state.code, codeEdited: state.codeEdited, testInput: input, lang: state.lang,
    }),
  })),
  runResult: null,
  setRunResult: result => set({ runResult: result }),
  runError: null,
  setRunError: error => set({ runError: error }),
  runLoading: false,
  setRunLoading: loading => set({ runLoading: loading }),

  localPracticeRecords: INITIAL_LOCAL_PRACTICE_RECORDS,
}))
