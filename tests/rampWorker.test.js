import test from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { createRampScenario } from "./helpers/rampScenario.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { calculateReachableActions } from "../src/domain/rules/moveGenerator.js";
import { startReachabilityJob } from "../src/features/reachabilityJob.js";

function browserWorkerAdapter() {
  const entry = new URL("../src/workers/reachabilityWorker.js", import.meta.url).href;
  const worker = new Worker(`
    const { parentPort } = require('node:worker_threads');
    globalThis.self = { postMessage: (data) => parentPort.postMessage(data) };
    import(${JSON.stringify(entry)}).then(() => parentPort.on('message', (data) => self.onmessage({ data })));
  `, { eval: true });
  const adapter = { postMessage: (data) => worker.postMessage(data), terminate: () => worker.terminate() };
  worker.on("message", (data) => adapter.onmessage?.({ data }));
  worker.on("error", () => adapter.onerror?.({ preventDefault() {} }));
  return adapter;
}

test("production worker matches synchronous ramp search for all orientations, roles and dice values", async () => {
  for (const direction of ["N", "E", "S", "W"]) {
    const session = createGameSession(createRampScenario(direction).map);
    for (const unit of [...session.policeUnits, ...session.thiefUnits]) unit.inCar = true;
    for (const turn of ["THIEF", "POLICE"]) {
      const units = turn === "THIEF" ? session.thiefUnits : session.policeUnits;
      for (const diceValue of [1, 6]) {
        const job = startReachabilityJob({ session, units, turn, diceValue }, browserWorkerAdapter);
        const results = await job.promise;
        assert.ok(results instanceof Map, "worker must return results rather than fall back");
        for (const unit of units) assert.deepEqual(results.get(unit.id), calculateReachableActions({ session, unit, turn, diceValue }));
      }
    }
  }
});
