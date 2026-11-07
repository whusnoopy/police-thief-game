import { getMapDimensions } from "../domain/map/mapDimensions.js";
import { calculateReachableActionsAsync } from "../domain/rules/moveGenerator.js";

function createWorker() {
  if (typeof Worker === "undefined") return null;
  return new Worker(new URL("../workers/reachabilityWorker.js", import.meta.url), { type: "module" });
}

// A job owns one worker. Every completion, failure or cancellation releases it.
// Small maps retain the synchronous fallback; large maps yield between batches.
export function startReachabilityJob(payload, workerFactory = createWorker) {
  let worker;
  const large = getMapDimensions(payload.session?.mapDefinition).rows > 10;
  try { worker = workerFactory(); } catch { /* Large maps use the cooperative fallback below. */ }
  if (!worker) return large ? startCooperativeJob(payload) : null;
  let settled = false;
  let resolveResult;
  let timeout;
  const promise = new Promise((resolve) => { resolveResult = resolve; });
  let fallback = null;
  function finish(results, cancelled = false) {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    worker.terminate();
    if (!results && large && !cancelled) {
      fallback = startCooperativeJob(payload);
      fallback.promise.then(resolveResult);
    } else resolveResult(results);
  }
  worker.onmessage = (event) => finish(event.data instanceof Map ? event.data : null);
  worker.onerror = (event) => { event.preventDefault?.(); finish(null); };
  worker.onmessageerror = () => finish(null);
  timeout = setTimeout(() => finish(null), 10000);
  try { worker.postMessage(payload); } catch { finish(null); }
  return { promise, cancel: () => { fallback?.cancel(); finish(null, true); } };
}

function startCooperativeJob({ session, turn, diceValue, units }) {
  let cancelled = false;
  const promise = (async () => {
    const results = new Map();
    for (const unit of units) {
      const moves = await calculateReachableActionsAsync({ session, turn, diceValue, unit }, { cancelled: () => cancelled });
      if (cancelled || !moves) return null;
      results.set(unit.id, moves);
    }
    return results;
  })();
  return { promise, cancel() { cancelled = true; } };
}
