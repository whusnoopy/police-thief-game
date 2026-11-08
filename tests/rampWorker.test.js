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

test("Worker and cooperative fallback honor explicit fractional balances instead of refilling from dice", async()=>{
  for(const direction of ["N","E","S","W"]) {
    const {map}=createRampScenario(direction);map.actionRules="continuous";
    const session=createGameSession(map),units=session.thiefUnits;units[0].inCar=true;
    for(const movementPoints of [0,1,2,7]) {
      const payload={session,units,turn:"THIEF",diceValue:6,movementPoints};
      const result=await startReachabilityJob(payload,browserWorkerAdapter).promise;
      assert.ok(result instanceof Map);
      const expected=calculateReachableActions({...payload,unit:units[0]});assert.deepEqual(result.get("T1"),expected);
      for(const action of expected.values())assert.ok(action.costSpent<=movementPoints);
      if(!movementPoints)assert.equal(expected.size,0);
    }
  }
  const {createNewMapDefinition,setLegacyTileAt}=await import("../src/domain/map/mapModel.js");
  const map=createNewMapDefinition();setLegacyTileAt(map,10,10,"THIEF_SPAWN");
  const session=createGameSession(map),units=session.thiefUnits;
  const payload={session,units,turn:"THIEF",diceValue:6,movementPoints:6};
  const result=await startReachabilityJob(payload,()=>null).promise;
  assert.equal(result.get("T1").size,4);
});

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

test("20×20 Worker and unavailable or failed Worker fallback match far-edge searches and release cancelled jobs", async () => {
  const { createNewMapDefinition, setLegacyTileAt } = await import("../src/domain/map/mapModel.js");
  const map=createNewMapDefinition();setLegacyTileAt(map,19,16,"THIEF_SPAWN");
  const session=createGameSession(map),units=session.thiefUnits;
  const payload={session,units,turn:"THIEF",diceValue:2};
  const expected=calculateReachableActions({...payload,unit:units[0]});
  for (const factory of [browserWorkerAdapter,()=>null,()=>{throw new Error("no worker");},()=>({postMessage(){throw new Error("failed clone");},terminate(){}})]) {
    const results=await startReachabilityJob(payload,factory).promise;
    assert.deepEqual(results.get("T1"),expected);
  }
  const job=startReachabilityJob({...payload,diceValue:6},()=>null);job.cancel();assert.equal(await job.promise,null);
});
