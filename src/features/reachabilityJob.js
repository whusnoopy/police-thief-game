function createWorker() {
  if (typeof Worker === "undefined") return null;
  return new Worker(new URL("../workers/reachabilityWorker.js", import.meta.url), { type: "module" });
}

// A job owns one worker. Every completion, failure or cancellation releases it.
// Returning null results asks the controller to use the synchronous fallback.
export function startReachabilityJob(payload, workerFactory = createWorker) {
  let worker;
  try { worker = workerFactory(); } catch { return null; }
  if (!worker) return null;
  let settled = false;
  let resolveResult;
  let timeout;
  const promise = new Promise((resolve) => { resolveResult = resolve; });
  function finish(results) {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    worker.terminate();
    resolveResult(results);
  }
  worker.onmessage = (event) => finish(event.data instanceof Map ? event.data : null);
  worker.onerror = (event) => { event.preventDefault?.(); finish(null); };
  worker.onmessageerror = () => finish(null);
  timeout = setTimeout(() => finish(null), 10000);
  try { worker.postMessage(payload); } catch { finish(null); }
  return { promise, cancel: () => finish(null) };
}
