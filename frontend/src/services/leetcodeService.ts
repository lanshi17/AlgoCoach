import axios from 'axios'
import type { Problem, RunResult, Submission } from '@/types'

axios.interceptors.response.use(response => response, error => {
  const response = error?.response
  const code = response?.data?.code
  if (response?.status === 401 && (code === 'COOKIE_MISSING' || code === 'COOKIE_EXPIRED') && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('algocoach:cookie-invalid'))
  }
  return Promise.reject(error)
})

export interface SubmissionResultDto {
  id: string
  status: Submission['status']
  runtimeMs: number | null
  memoryMb: number | null
  passedTests: number | null
  totalTests: number | null
  errorMessage: string | null
  durationSec: number
}

/**
 * Java Spring Boot gateway at /api/*
 * Acts as a proxy to LeetCode GraphQL with stored cookies.
 */
export const leetcodeService = {
  async authStatus() {
    const { data } = await axios.get<{ authenticated: boolean }>('/api/auth/status')
    if (!data.authenticated) return false
    try {
      return await this.verifyCookie()
    } catch {
      return false
    }
  },

  async verifyCookie() {
    const { data } = await axios.get<{ authenticated: boolean }>('/api/auth/validate')
    return data.authenticated
  },

  async listProblems(params: { page?: number; difficulty?: string; topicSlugs?: string[] }) {
    const { data } = await axios.get('/api/problems', {
      params: {
        page: params.page,
        difficulty: params.difficulty || undefined,
        // The gateway expands comma-separated slugs into a topic OR-filter.
        tag: params.topicSlugs?.length ? params.topicSlugs.join(',') : undefined,
      },
    })
    const result = data?.data?.problemsetQuestionList ?? data?.problemsetQuestionList ?? data
    const problems = (result?.questions ?? []).map((item: Record<string, unknown>) => ({
      id: String(item.questionId ?? item.frontendQuestionId ?? item.titleSlug ?? ''),
      platform: 'LEETCODE' as const,
      platformId: String(item.titleSlug ?? ''),
      title: String(item.title ?? item.titleSlug ?? '未命名题目'),
      difficulty: normalizeDifficulty(item.difficulty),
      contentHtml: '',
      topics: Array.isArray(item.topicTags)
        ? item.topicTags.map(tag => typeof tag === 'string' ? tag : String((tag as { name?: string }).name ?? ''))
        : [],
      codeSnippets: [],
      sampleTestCases: '',
    })) as Problem[]
    const hasMore = result?.hasMore === true
    const fallbackTotal = hasMore ? Number(params.page ?? 1) * 50 + 1 : ((Number(params.page ?? 1) - 1) * 50 + problems.length)
    return { problems, total: Number(result?.totalLength ?? result?.total ?? fallbackTotal), pageSize: 50 }
  },

  async getProblem(titleSlug: string) {
    const { data } = await axios.get<Record<string, unknown>>(`/api/problems/${titleSlug}`)
    const tags = Array.isArray(data.topicTags) ? data.topicTags : []
    const snippets = Array.isArray(data.codeSnippets) ? data.codeSnippets : []
    return {
      id: String(data.questionId ?? data.titleSlug ?? titleSlug),
      platform: 'LEETCODE',
      platformId: String(data.titleSlug ?? titleSlug),
      title: String(data.title ?? titleSlug),
      titleCn: typeof data.translatedTitle === 'string' ? data.translatedTitle : undefined,
      difficulty: normalizeDifficulty(data.difficulty),
      contentHtml: String(data.translatedContent ?? data.content ?? ''),
      contentMd: undefined,
      topics: tags.map(tag => {
        const value = tag as { name?: string; translatedName?: string; nameTranslated?: string }
        return value.translatedName || value.nameTranslated || value.name || ''
      }).filter(Boolean),
      hints: Array.isArray(data.hints) ? data.hints.map(String) : [],
      codeSnippets: snippets.map(snippet => {
        const value = snippet as { langSlug?: string; lang?: string; code?: string }
        return { lang: normalizeLanguage(value.langSlug ?? value.lang ?? ''), code: value.code ?? '' }
      }),
      sampleTestCases: String(data.sampleTestCase ?? ''),
    } as Problem
  },

  async getDaily() {
    const { data } = await axios.get<Problem>('/api/problems/daily')
    return data
  },

  async runTests(titleSlug: string, code: string, lang: string, testInput: string) {
    const { data } = await axios.post<RunResult>('/api/run', { titleSlug, code, lang, testInput })
    return data
  },

  async submit(titleSlug: string, code: string, lang: string, durationSec: number) {
    const { data } = await axios.post<SubmissionResultDto>('/api/submit', {
      titleSlug, code, lang, durationSec,
    })
    return data
  },

  async submissionHistory() {
    const { data } = await axios.get('/api/submissions', { params: { limit: 1000 } })
    return data
  },

  async setCookie(session: string, csrf: string) {
    await axios.post('/api/auth/cookie', { session, csrf })
  },
}

function normalizeDifficulty(value: unknown): Problem['difficulty'] {
  const normalized = String(value ?? '').toUpperCase()
  if (normalized === 'EASY' || normalized === 'MEDIUM' || normalized === 'HARD') return normalized
  return 'MEDIUM'
}

function normalizeLanguage(value: string): string {
  const lang = value.toLowerCase()
  if (lang.includes('python')) return 'python3'
  if (lang === 'rust') return 'rust'
  if (lang === 'cpp' || lang.includes('c++')) return 'cpp'
  return lang
}
