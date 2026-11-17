// ─── Domain Types ───

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
export type Platform = 'LEETCODE' | 'LUOGU' | 'CODEFORCES' | 'ACWING' | 'HDU'
export type AgentMode = 'IDLE' | 'PREP' | 'FOCUS' | 'REVIEW'
export type TrainingGoal = 'interview_prep' | 'contest' | 'casual'
export type TrainingPhase =
  | 'auto'
  | 'virtual_contest'
  | 'topic_drill'
  | 'attempt'
  | 'hint'
  | 'review'
  | 'upsolve'

export type CoachStyle = 'auto' | 'socratic' | 'direct'

/** 设置 → AI 教练。Persisted per browser and sent with every chat request. */
export interface CoachPrefs {
  autoReview: boolean
  showThinking: boolean
  animations: boolean
  coachStyle: CoachStyle
}

/** LeetCode langSlug values the editor supports. */
export type CodeLanguage = 'rust' | 'cpp' | 'python3' | 'typescript' | 'golang' | 'java'

export type ProviderProtocol =
  | 'anthropic' | 'openai' | 'openai-response' | 'deepseek' | 'dashscope' | 'gemini'
  | 'moonshot' | 'minimax' | 'ollama' | 'volcengine' | 'xai'

export interface ModelProviderConfig {
  id: string
  name: string
  protocol: ProviderProtocol
  baseUrl: string
  model: string
  apiKey: string
}

export interface Problem {
  id: string
  platform: Platform
  platformId: string          // e.g. leetcode titleSlug
  title: string
  titleCn?: string
  difficulty: Difficulty
  contentHtml: string         // rendered problem statement
  contentMd?: string
  topics: string[]            // ['Array','DP',...]
  hints?: string[]
  codeSnippets: CodeSnippet[]
  sampleTestCases: string
  contestNumber?: number
  dailyQuestion?: boolean
  /** True when the platform confirms the user has an accepted solution. */
  accepted?: boolean
}

export interface CodeSnippet {
  lang: string               // LeetCode langSlug (superset of CodeLanguage)
  code: string
}

export interface Submission {
  id: string
  problemId: string
  code: string
  lang: string
  status: SubmissionStatus
  runtimeMs?: number
  memoryMb?: number
  passedTests: number
  totalTests: number
  errorMessage?: string
  submittedAt: string         // ISO
  durationSec: number          // time spent in FOCUS mode
  editTrailLength?: number    // keystrokes during focus
}

/** Raw terminal response returned by LeetCode's interpret_solution endpoint. */
export interface RunResult {
  state?: string
  status_msg?: string
  code_answer?: string[]
  expected_code_answer?: string[]
  std_output_list?: string[]
  total_correct?: number
  total_testcases?: number
  compile_error?: string
  runtime_error?: string
}

export type SubmissionStatus =
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'TIME_LIMIT'
  | 'RUNTIME_ERROR'
  | 'COMPILE_ERROR'
  | 'MEMORY_LIMIT'

// ─── Agent / Chat ───

export interface ChatMessage {
  id: string
  role: 'user' | 'agent' | 'system'
  content: string
  timestamp: string
  mode?: AgentMode
  trainingPhase?: TrainingPhase
  animationId?: string        // if message carries a Remotion animation
  retryMessageId?: string     // system error that can retry a user message
  action?: { href: string; label: string } // optional repair action for system messages
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  name: string                // 'generate_animation' | 'fetch_weakness' | ...
  args: Record<string, unknown>
  result?: unknown
}

// ─── Memory ───

export interface KnowledgeNode {
  topic: string               // 'BFS' | 'DP' | ...
  mastery: number              // 0-1 confidence
  attempts: number
  lastSeen: string
  weakSubtopics: string[]
  relatedTopics: string[]
}

export interface UserProfile {
  preferredLang: CodeLanguage
  weakTopics: string[]
  strongTopics: string[]
  avgSolveTimeSec: number
  commonMistakes: string[]
  goals: string[]              // 'interview_prep' | 'contest' | ...
}

export interface AgentProfile {
  topics: Array<{
    topic: string
    mastery: number
    attempts: number
    lastSeen: string
    weakSubtopics: string[]
    relatedTopics: string[]
  }>
  edges: Array<{ from: string; to: string; weight: number }>
  recentProblems: Array<{
    problemId: string
    platform: string
    status: string
    topics: string[]
    durationSec: number
    createdAt: string
  }>
  dailyAttempts: Array<{ date: string; count: number }>
  stats: {
    totalAttempts: number
    accepted: number
    averageDurationSec: number
    streakDays: number
  }
}

export interface KnowledgeEmbeddingConfig {
  provider: 'local' | 'openai-compatible'
  model: string
  baseUrl: string
  hasApiKey: boolean
  dimensions: number | null
}

export interface KnowledgeSource {
  id: string
  name: string
  bytes: number
  updatedAt: number
  chunks?: number
}

export interface KnowledgeStatus {
  config: KnowledgeEmbeddingConfig
  sources: KnowledgeSource[]
  indexedChunks: number
}

// ─── Animation ───

export interface AnimationJob {
  id: string
  kind?: string
  topic?: string
  problemId?: string
  title: string
  status: 'QUEUED' | 'RENDERING' | 'READY' | 'FAILED'
  videoUrl?: string
  error?: string
}
