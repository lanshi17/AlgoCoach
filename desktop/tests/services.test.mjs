import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertSidecarPlatform, startLocalServices } from '../services.mjs'

test('validates the sidecar platform manifest against the running process', async () => {
  const root = await mkdtemp(join(tmpdir(), 'algocoach-sidecar-manifest-'))
  try {
    await writeFile(join(root, 'platform.json'), JSON.stringify({ platform: process.platform, arch: process.arch }))
    assert.equal(assertSidecarPlatform(root).platform, process.platform)
    await writeFile(join(root, 'platform.json'), JSON.stringify({ platform: process.platform, arch: process.arch === 'x64' ? 'arm64' : 'x64' }))
    assert.throws(() => assertSidecarPlatform(root), /侧车架构/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects a partial sidecar instead of falling back to host Python', async () => {
  const root = await mkdtemp(join(tmpdir(), 'algocoach-partial-sidecar-'))
  try {
    await mkdir(join(root, 'python/bin'), { recursive: true })
    await writeFile(join(root, 'python/bin/python3.12'), '')
    assert.throws(() => startLocalServices({ root, enabled: true }), /侧车运行时不完整/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('stopping after the agent executable failed to spawn completes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'algocoach-services-'))
  const previousPath = process.env.PATH
  const previousPython = process.env.ALGOCOACH_PYTHON
  try {
    await mkdir(join(root, 'backend/agent/app'), { recursive: true })
    await writeFile(join(root, 'backend/agent/app/main.py'), '')
    process.env.PATH = root
    delete process.env.ALGOCOACH_PYTHON
    const services = startLocalServices({ root, enabled: true })
    assert.equal(services.processes.length, 1)
    await new Promise(resolve => services.processes[0].child.once('close', resolve))
    await Promise.race([services.stop(), new Promise((_, reject) => setTimeout(() => reject(new Error('stop hung')), 1000))])
  } finally {
    process.env.PATH = previousPath
    if (previousPython === undefined) delete process.env.ALGOCOACH_PYTHON
    else process.env.ALGOCOACH_PYTHON = previousPython
    await rm(root, { recursive: true, force: true })
  }
})

test('stopping a running owned agent terminates its process', async () => {
  const root = await mkdtemp(join(tmpdir(), 'algocoach-services-'))
  const previousPython = process.env.ALGOCOACH_PYTHON
  try {
    await mkdir(join(root, 'backend/agent/app'), { recursive: true })
    await writeFile(join(root, 'backend/agent/app/main.py'), '')
    process.env.ALGOCOACH_PYTHON = process.execPath
    const services = startLocalServices({ root, enabled: true })
    await services.stop()
    assert.ok(services.processes[0].closed)
  } finally {
    if (previousPython === undefined) delete process.env.ALGOCOACH_PYTHON
    else process.env.ALGOCOACH_PYTHON = previousPython
    await rm(root, { recursive: true, force: true })
  }
})
