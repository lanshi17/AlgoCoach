import axios from 'axios'
import type { Problem } from '@/types'

interface AcWingSummary {
  platformId?: string
  title?: string
  difficulty?: string
  url?: string
  topics?: string[]
}

/**
 * AcWing list/detail through the gateway (requires the stored cookie).
 * `tag` routes to the site's tag search (专项筛选).
 */
export const acwingService = {
  async listProblems(params: { page?: number; tag?: string }) {
    const { data } = await axios.get<{ total?: number; pageSize?: number; problems?: AcWingSummary[] }>(
      '/api/acwing/problems', { params: { page: params.page, tag: params.tag || undefined } },
    )
    return {
      problems: (data.problems ?? []).map(toProblem),
      total: Number(data.total ?? 0),
      pageSize: Number(data.pageSize ?? 50),
    }
  },

  async getProblem(problemId: string): Promise<Problem> {
    const { data } = await axios.get<Problem>(`/api/acwing/problems/${encodeURIComponent(problemId)}`)
    return data
  },
}

function toProblem(item: AcWingSummary): Problem {
  const platformId = String(item.platformId ?? '')
  return {
    id: platformId,
    platform: 'ACWING',
    platformId,
    title: String(item.title ?? platformId),
    difficulty: item.difficulty === 'EASY' || item.difficulty === 'HARD' ? item.difficulty : 'MEDIUM',
    contentHtml: '',
    topics: Array.isArray(item.topics) ? item.topics : [],
    codeSnippets: [],
    sampleTestCases: '',
  }
}
