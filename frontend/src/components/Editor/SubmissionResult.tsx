import React from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { CheckCircle, XCircle, Clock, Cpu } from 'lucide-react'

export default function SubmissionResult() {
  const lastSubmission = useAppStore(state => state.lastSubmission)

  if (!lastSubmission) return (
    <div className="code-output-panel flex items-center justify-center text-xs code-muted">
      本次练习没有提交结果，可以在教练面板自主复盘。
    </div>
  )

  const ok = lastSubmission.status === 'ACCEPTED'

  return (
    <div className="code-output-panel flex flex-col gap-3 overflow-auto p-4 text-xs">
      {/* Status */}
      <div className={`flex items-center gap-2 font-semibold text-sm ${ok ? 'text-success' : 'text-danger'}`}>
        {ok ? <CheckCircle size={18} /> : <XCircle size={18} />}
        {lastSubmission.status.replace('_', ' ')}
      </div>

      {/* Stats */}
      <div className="flex gap-6">
        {lastSubmission.runtimeMs && (
          <div className="flex items-center gap-1.5 code-muted">
            <Clock size={13} />
            {lastSubmission.runtimeMs} ms
          </div>
        )}
        {lastSubmission.memoryMb && (
          <div className="flex items-center gap-1.5 code-muted">
            <Cpu size={13} />
            {lastSubmission.memoryMb} MB
          </div>
        )}
        <div className="code-muted">
          用时 {Math.floor(lastSubmission.durationSec / 60)}分
          {lastSubmission.durationSec % 60}秒
        </div>
      </div>

      {/* Error */}
      {lastSubmission.errorMessage && (
        <pre className="code-error-box text-xs font-mono overflow-auto whitespace-pre-wrap">
          {lastSubmission.errorMessage}
        </pre>
      )}
    </div>
  )
}
