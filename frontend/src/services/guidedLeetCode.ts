import type { CodeLanguage, Problem, RunResult } from '@/types'
import { TRAINING_TOPICS } from './trainingTopics'

export function topicSlugsFor(topic: string): string[] {
  const value = topic.trim().toLowerCase()
  if (!value) return []
  const match = TRAINING_TOPICS.find(item => (
    value.includes(item.name.toLowerCase())
    || item.name.toLowerCase().includes(value)
    || item.slugs.some(slug => value.includes(slug))
  ))
  return match?.slugs ?? []
}

export function problemSnippet(problem: Problem, language: CodeLanguage): string | null {
  return problem.codeSnippets.find(snippet => snippet.lang === language)?.code ?? null
}

export function describeRunResult(result: RunResult): string {
  if (result.compile_error) return '编译错误'
  if (result.runtime_error) return '运行错误'
  if (result.total_testcases != null) return `${result.total_correct ?? 0}/${result.total_testcases} 样例通过`
  return result.status_msg ?? result.state ?? '已返回'
}
