/* global window, URL, Blob, Worker */
/* Runs only inside an opaque, CSP-restricted sandboxed iframe. */
window.addEventListener('message', event => {
  if (event.source !== window.parent || event.data?.kind !== 'start') return
  const { workerSource, assets, code, args, functionName } = event.data
  const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }))
  const worker = new Worker(url)
  worker.onmessage = message => window.parent.postMessage({ kind: 'worker', payload: message.data }, '*')
  worker.onerror = () => window.parent.postMessage({ kind: 'worker-error' }, '*')
  worker.postMessage({ assets, code, args, functionName })
}, { once: true })
window.parent.postMessage({ kind: 'sandbox-ready' }, '*')
