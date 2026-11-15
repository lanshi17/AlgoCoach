import axios from 'axios'
import type { Problem } from '@/types'

interface HduSummary {
  platformId?: string
  title?: string
  difficulty?: string
  url?: string
  topics?: string[]
}

/** HDU list/detail through the gateway (volume pages hold 100 problems). */
export const hduService = {
  async listProblems(params: { volume?: number }) {
    const { data } = await axios.get<{ total?: number; pageSize?: number; problems?: HduSummary[] }>(
      '/api/hdu/problems', { params: { volume: params.volume } },
    )
    return {
      problems: (data.problems ?? []).map(toProblem),
      total: Number(data.total ?? 0),
      pageSize: Number(data.pageSize ?? 100),
    }
  },

  async getProblem(problemId: string): Promise<Problem> {
    const { data } = await axios.get<Problem>(`/api/hdu/problems/${encodeURIComponent(problemId)}`)
    return data
  },
}

function toProblem(item: HduSummary): Problem {
  const platformId = String(item.platformId ?? '')
  return {
    id: platformId,
    platform: 'HDU',
    platformId,
    title: String(item.title ?? platformId),
    difficulty: 'MEDIUM',
    contentHtml: '',
    topics: Array.isArray(item.topics) ? item.topics : [],
    codeSnippets: [],
    sampleTestCases: '',
  }
}
