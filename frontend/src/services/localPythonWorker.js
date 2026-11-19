/* global self, URL */
/* The embedding iframe enforces an opaque origin and a no-network CSP. */
self.onmessage = async ({ data }) => {
  try {
    const urls = Object.fromEntries(Object.entries(data.assets).map(([name, blob]) => [name, URL.createObjectURL(blob)]))
    const nativeImportScripts = self.importScripts.bind(self)
    const nativeFetch = self.fetch.bind(self)
    self.importScripts = (...paths) => nativeImportScripts(...paths.map(path => path.endsWith('/pyodide.asm.js') ? urls.asm : path))
    self.fetch = (path, options) => {
      const value = String(path)
      if (value.endsWith('/pyodide.asm.wasm')) return nativeFetch(urls.wasm, options)
      return nativeFetch(path, options)
    }
    nativeImportScripts(urls.loader)
    const output = []
    const print = text => { if (output.join('\n').length < 8192) output.push(String(text).slice(0, 8192)) }
    const pyodide = await self.loadPyodide({
      indexURL: 'https://runtime.invalid/', lockFileURL: urls.lock, stdLibURL: urls.stdlib,
      jsglobals: Object.create(null), stdout: print, stderr: print,
    })
    self.postMessage({ type: 'loaded' })
    pyodide.globals.set('__practice_input', JSON.stringify(data.args))
    pyodide.runPython(data.code)
    const result = pyodide.runPython(`import json as __practice_json\n__practice_args = __practice_json.loads(__practice_input)\n__practice_json.dumps(${data.functionName}(__practice_args["nums"], __practice_args["target"]), ensure_ascii=False)`)
    self.postMessage({ type: 'result', output: String(result).slice(0, 8192), stdout: output.join('\n').slice(0, 8192) })
  } catch (error) {
    self.postMessage({ type: 'error', message: String(error).slice(0, 4000) })
  }
}
