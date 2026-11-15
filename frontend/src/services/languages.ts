import type { CodeLanguage } from '@/types'

// LeetCode langSlug values are the canonical language keys everywhere in the
// app: problem snippets, Monaco, the Gateway run/submit payload, and history.
export const CODE_LANGUAGES: readonly CodeLanguage[] = [
  'rust', 'cpp', 'python3', 'typescript', 'golang', 'java',
]

export const LANGUAGE_OPTIONS: Array<{ value: CodeLanguage; label: string }> = [
  { value: 'rust', label: 'Rust' },
  { value: 'cpp', label: 'C++' },
  { value: 'python3', label: 'Python 3' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'golang', label: 'Go' },
  { value: 'java', label: 'Java' },
]

/** Monaco language id for each LeetCode langSlug. */
export const MONACO_LANGUAGES: Record<CodeLanguage, string> = {
  rust: 'rust', cpp: 'cpp', python3: 'python',
  typescript: 'typescript', golang: 'go', java: 'java',
}
