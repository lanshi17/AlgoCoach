import React from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { CheckCircle, XCircle, Clock, Cpu } from 'lucide-react'

export default function SubmissionResult() {
  const { lastSubmission } = useAppStore()

  if (!lastSubmission) return (
    <div className="flex items-center justify-center h-full text-xs text-text-muted dark:text-text-dark-muted">
      本次练习没有提交结果，可以在教练面板自主复盘。
    </div>
  )

  const ok = lastSubmission.status === 'ACCEPTED'

  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-auto text-xs">
      {/* Status */}
      <div className={`flex items-center gap-2 font-semibold text-sm ${ok ? 'text-success' : 'text-danger'}`}>
        {ok ? <CheckCircle size={18} /> : <XCircle size={18} />}
        {lastSubmission.status.replace('_', ' ')}
      </div>

      {/* Stats */}
      <div className="flex gap-6">
        {lastSubmission.runtimeMs && (
          <div className="flex items-center gap-1.5 text-text-secondary dark:text-text-dark-secondary">
            <Clock size={13} />
            {lastSubmission.runtimeMs} ms
          </div>
        )}
        {lastSubmission.memoryMb && (
          <div className="flex items-center gap-1.5 text-text-secondary dark:text-text-dark-secondary">
            <Cpu size={13} />
            {lastSubmission.memoryMb} MB
          </div>
        )}
        <div className="text-text-muted dark:text-text-dark-muted">
          用时 {Math.floor(lastSubmission.durationSec / 60)}分
          {lastSubmission.durationSec % 60}秒
        </div>
      </div>

      {/* Error */}
      {lastSubmission.errorMessage && (
        <pre className="text-xs font-mono text-danger bg-red-50 dark:bg-red-900/10 p-3 rounded-lg
                        overflow-auto whitespace-pre-wrap border border-red-200 dark:border-red-900/30">
          {lastSubmission.errorMessage}
        </pre>
      )}
    </div>
  )
}
