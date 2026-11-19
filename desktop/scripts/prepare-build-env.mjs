import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktop = fileURLToPath(new URL('..', import.meta.url))
const envDir = join(desktop, 'sidecar-build-env')
const lock = join(desktop, 'agent-requirements.lock')
function run(args) {
  const result = spawnSync('uv', args, { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`uv failed: ${args[0]}`)
}
run(['venv', '--clear', '--managed-python', '--python', '3.12', envDir])
run(['pip', 'sync', '--require-hashes', '--python', join(envDir, 'bin/python'), lock])
