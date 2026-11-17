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
    <div className="code-output-panel">
      {/* Tab row */}
      <div className="code-tabbar">
        {samples.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={activeCase === i}
            onClick={() => selectCase(i)}
            className="code-tab"
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
            className="code-tab"
          >
            自定义 {i + 1}
          </button>
        ))}
        <button onClick={addCustomCase} title="添加自定义测试" aria-label="添加自定义测试"
          className="code-add-tab">
          <Plus size={14} />
        </button>
      </div>

      {/* Input / output */}
      <div className="code-output-body">
        <div className="code-pane">
          <div className="code-label">输入</div>
          <textarea
            aria-label="测试输入"
            value={testInput}
            onChange={event => updateInput(event.target.value)}
            placeholder="输入测试数据…"
            className="code-input"
          />
        </div>
        <div className="code-pane">
          <div className="mb-1 flex items-center justify-between code-label">
            <span>运行结果{runStatus ? ` · ${runStatus}` : ''}</span>
            {runResult && runResult.total_correct != null && runResult.total_testcases != null && (
              <span>{runResult.total_correct}/{runResult.total_testcases} 通过</span>
            )}
          </div>
          {runLoading ? (
            <p className="code-muted">正在运行测试…</p>
          ) : runError ? (
            <pre role="alert" className="code-error whitespace-pre-wrap">{runError}</pre>
          ) : runResult ? (
            <div className="space-y-2 whitespace-pre-wrap">
              {actualOutput && <pre>输出：{actualOutput}</pre>}
              {expectedOutput && <pre className="code-muted">预期：{expectedOutput}</pre>}
              {runResult.compile_error && <pre className="code-error">{runResult.compile_error}</pre>}
              {runResult.runtime_error && <pre className="code-error">{runResult.runtime_error}</pre>}
              {!actualOutput && !expectedOutput && !runResult.compile_error && !runResult.runtime_error && (
                <pre className="code-muted">暂无输出</pre>
              )}
            </div>
          ) : (
            <pre className="code-muted">点击「运行」查看程序输出</pre>
          )}
        </div>
      </div>
    </div>
  )
}
