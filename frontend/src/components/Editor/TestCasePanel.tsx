import React, { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/stores/useAppStore'
import { Plus } from 'lucide-react'

export default function TestCasePanel() {
  const {
    activeProblem, testInput, setTestInput, runResult, setRunResult,
    runError, setRunError, runLoading,
  } = useAppStore(useShallow(state => ({
    activeProblem: state.activeProblem,
    testInput: state.testInput,
    setTestInput: state.setTestInput,
    runResult: state.runResult,
    setRunResult: state.setRunResult,
    runError: state.runError,
    setRunError: state.setRunError,
    runLoading: state.runLoading,
  })))
  const [activeCase, setActiveCase] = useState(0)
  const [customCases, setCustomCases] = useState<string[]>([])

  const samples = useMemo(() => activeProblem?.sampleTestCases
    ? activeProblem.sampleTestCases.split('\n---\n')
    : [], [activeProblem?.sampleTestCases])

  useEffect(() => {
    const savedInput = useAppStore.getState().testInput
    const sampleIndex = samples.indexOf(savedInput)
    if (sampleIndex >= 0) {
      setCustomCases([])
      setActiveCase(sampleIndex)
    } else if (savedInput) {
      setCustomCases([savedInput])
      setActiveCase(samples.length)
    } else {
      setCustomCases([])
      setActiveCase(0)
    }
  }, [activeProblem?.platform, activeProblem?.platformId, samples])

  const selectCase = (index: number) => {
    setActiveCase(index)
    setTestInput(index < samples.length ? samples[index] : customCases[index - samples.length] ?? '')
    setRunResult(null)
    setRunError(null)
  }

  const addCustomCase = () => {
    const next = [...customCases, '']
    setCustomCases(next)
    setActiveCase(samples.length + next.length - 1)
    setTestInput('')
    setRunResult(null)
    setRunError(null)
  }

  const updateInput = (value: string) => {
    setTestInput(value)
    setRunResult(null)
    setRunError(null)
    if (activeCase >= samples.length) {
      setCustomCases(current => current.map((item, index) =>
        index === activeCase - samples.length ? value : item))
    }
  }

  const actualOutput = runResult?.code_answer?.join('\n')
  const expectedOutput = runResult?.expected_code_answer?.join('\n')
  const runStatus = runResult?.status_msg ?? runResult?.state

  if (!activeProblem) return null

  return (
    <div className="flex flex-col h-full text-xs font-mono">
      {/* Tab row */}
      <div className="flex items-center gap-1 px-3 h-9 overflow-x-auto border-b border-border dark:border-border-dark
                      bg-surface-soft dark:bg-surface-dark-soft">
        {samples.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={activeCase === i}
            onClick={() => selectCase(i)}
            className={`shrink-0 px-2.5 py-1 rounded text-xs transition-colors ${
              activeCase === i
                ? 'bg-accent text-white'
                : 'text-text-secondary dark:text-text-dark-secondary hover:bg-surface-muted dark:hover:bg-surface-dark-muted'
            }`}
          >
            样例 {i + 1}
          </button>
        ))}
        {customCases.map((_, i) => (
          <button
            key={`custom-${i}`}
            type="button"
            aria-pressed={activeCase === samples.length + i}
            onClick={() => selectCase(samples.length + i)}
            className={`shrink-0 px-2.5 py-1 rounded text-xs transition-colors ${
              activeCase === samples.length + i
                ? 'bg-accent text-white'
                : 'text-text-secondary dark:text-text-dark-secondary hover:bg-surface-muted dark:hover:bg-surface-dark-muted'
            }`}
          >
            自定义 {i + 1}
          </button>
        ))}
        <button onClick={addCustomCase} title="添加自定义测试" aria-label="添加自定义测试"
          className="ml-auto text-text-muted hover:text-text-secondary transition-colors">
          <Plus size={14} />
        </button>
      </div>

      {/* Input / output */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 p-3 overflow-auto">
          <div className="text-text-muted dark:text-text-dark-muted mb-1">输入：</div>
          <textarea
            aria-label="测试输入"
            value={testInput}
            onChange={event => updateInput(event.target.value)}
            placeholder="输入测试数据…"
            className="h-[calc(100%-1rem)] min-h-16 w-full resize-none bg-transparent font-mono text-text-primary
                       dark:text-text-dark-primary whitespace-pre-wrap outline-none"
          />
        </div>
        <div className="w-px bg-border dark:bg-border-dark" />
        <div className="flex-1 p-3 overflow-auto">
          <div className="flex items-center justify-between text-text-muted dark:text-text-dark-muted mb-1">
            <span>运行结果{runStatus ? ` · ${runStatus}` : ''}</span>
            {runResult && runResult.total_correct != null && runResult.total_testcases != null && (
              <span>{runResult.total_correct}/{runResult.total_testcases} 通过</span>
            )}
          </div>
          {runLoading ? (
            <p className="text-text-muted dark:text-text-dark-muted">正在运行测试…</p>
          ) : runError ? (
            <pre role="alert" className="whitespace-pre-wrap text-danger">{runError}</pre>
          ) : runResult ? (
            <div className="space-y-2 whitespace-pre-wrap">
              {actualOutput && <pre className="text-text-primary dark:text-text-dark-primary">输出：{actualOutput}</pre>}
              {expectedOutput && <pre className="text-text-muted dark:text-text-dark-muted">预期：{expectedOutput}</pre>}
              {runResult.compile_error && <pre className="text-danger">{runResult.compile_error}</pre>}
              {runResult.runtime_error && <pre className="text-danger">{runResult.runtime_error}</pre>}
              {!actualOutput && !expectedOutput && !runResult.compile_error && !runResult.runtime_error && (
                <pre className="text-text-muted dark:text-text-dark-muted">暂无输出</pre>
              )}
            </div>
          ) : (
            <pre className="text-text-muted dark:text-text-dark-muted">点击「运行」查看程序输出</pre>
          )}
        </div>
      </div>
    </div>
  )
}
