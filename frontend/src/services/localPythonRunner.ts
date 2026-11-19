import loaderSource from 'pyodide/pyodide.js?raw'
import asmSource from 'pyodide/pyodide.asm.js?raw'
import wasmUrl from 'pyodide/pyodide.asm.wasm?url'
import stdlibUrl from 'pyodide/python_stdlib.zip?url'
import lockUrl from 'pyodide/pyodide-lock.json?url'
import iframeSource from './localPythonSandbox.js?raw'
import workerSource from './localPythonWorker.js?raw'
import type { RunResult } from '@/types'

export function parseLocalPythonInput(input: string): { nums: number[]; target: number } {
  const lines = input.trim().split(/\r?\n/)
  if (lines.length !== 2 || !/^-?\d+$/.test(lines[1].trim())) throw new Error('请输入两行：整数数组和目标整数。')
  let nums: unknown
  try {
    nums = lines[0].trim().startsWith('[') ? JSON.parse(lines[0]) : lines[0].trim().split(/[\s,]+/).map(value => {
      if (!/^-?\d+$/.test(value)) throw new Error('invalid')
      return Number(value)
    })
  } catch { throw new Error('数组格式无效，请输入整数数组。') }
  const target = Number(lines[1].trim())
  if (!Array.isArray(nums) || nums.length > 10000 || !nums.every(Number.isSafeInteger) || !Number.isSafeInteger(target)) throw new Error('请输入最多 10000 个安全整数。')
  return { nums, target }
}

export function localPythonSampleResult(problemId: string, input: string, output: string): { passed: boolean; expected: string } | null {
  let value: unknown
  try { value = JSON.parse(output) } catch { return null }
  if (problemId === 'local-two-sum' && input.trim() === '2 7 11 15\n9') return { passed: Array.isArray(value) && value.length === 2 && value.includes(0) && value.includes(1), expected: '[0, 1]（顺序不限）' }
  if (problemId === 'local-binary-search' && input.trim() === '-1 0 3 5 9 12\n9') return { passed: value === 4, expected: '4' }
  return null
}

export const LOCAL_PYTHON_SANDBOX_CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; worker-src blob:; connect-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'"

const assets = { wasm: wasmUrl, stdlib: stdlibUrl, lock: lockUrl }
const mime: Record<string, string> = { loader: 'text/javascript', asm: 'text/javascript', wasm: 'application/wasm', stdlib: 'application/zip', lock: 'application/json' }

export async function runLocalPython(problemId: string, code: string, input: string): Promise<RunResult> {
  const functionName = ({ 'local-two-sum': 'two_sum', 'local-binary-search': 'search' } as Record<string, string>)[problemId]
  if (!functionName) throw new Error('这道本地题暂不支持运行。')
  if (code.length > 50000) throw new Error('代码不能超过 50000 个字符。')
  const args = parseLocalPythonInput(input)
  const entries = await Promise.all(Object.entries(assets).map(async ([name, url]) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error('本地 Python 运行时加载失败。')
    return [name, new Blob([await response.arrayBuffer()], { type: mime[name] })] as const
  }))
  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.hidden = true
  frame.srcdoc = `<meta http-equiv="Content-Security-Policy" content="${LOCAL_PYTHON_SANDBOX_CSP}"><script>${iframeSource}</script>`
  document.body.appendChild(frame)
  return await new Promise<RunResult>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>
    const finish = (error?: string, result?: RunResult) => {
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      frame.remove()
      if (error) reject(new Error(error)); else resolve(result!)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return
      if (event.data?.kind === 'sandbox-ready') {
        frame.contentWindow?.postMessage({ kind: 'start', workerSource, assets: { ...Object.fromEntries(entries), loader: new Blob([loaderSource], { type: 'text/javascript' }), asm: new Blob([asmSource], { type: 'text/javascript' }) }, code, args, functionName }, '*')
      } else if (event.data?.kind === 'worker-error') finish('本地 Python 运行时出错。')
      else if (event.data?.kind === 'worker') {
        const result = event.data.payload
        if (result?.type === 'loaded') { clearTimeout(timer); timer = setTimeout(() => finish('运行超时（3 秒），请检查是否存在无限循环。'), 3000) }
        else if (result?.type === 'error') finish(result.message || '运行失败。')
        else if (result?.type === 'result') {
          const sample = localPythonSampleResult(problemId, input, result.output)
          finish(undefined, { status_msg: sample ? (sample.passed ? '样例通过' : '样例未通过') : '运行完成', code_answer: [result.output], expected_code_answer: sample ? [sample.expected] : undefined, std_output_list: result.stdout ? [result.stdout] : undefined })
        }
      }
    }
    window.addEventListener('message', onMessage)
    timer = setTimeout(() => finish('本地 Python 运行时启动超时。'), 30000)
  })
}
