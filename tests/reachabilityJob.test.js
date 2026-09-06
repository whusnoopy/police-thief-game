import test from "node:test";
import assert from "node:assert/strict";
import { startReachabilityJob } from "../src/features/reachabilityJob.js";

function worker() {
  return { stopped: 0, postMessage(payload) { this.payload = payload; }, terminate() { this.stopped++; } };
}

test("worker results retain maps and every finished worker is released", async () => {
  const fake = worker();
  const job = startReachabilityJob({ diceValue: 6 }, () => fake);
  const results = new Map([["T1", new Map([["0,1", { type: "MOVE" }]])]]);
  fake.onmessage({ data: results });
  assert.equal(await job.promise, results);
  assert.equal(fake.stopped, 1);
  job.cancel();
  assert.equal(fake.stopped, 1);
});

test("cancellation ignores late results and load or message failures request fallback", async () => {
  for (const failure of ["cancel", "error", "messageerror", "invalid"]) {
    const fake = worker();
    const job = startReachabilityJob({}, () => fake);
    if (failure === "cancel") job.cancel();
    if (failure === "error") fake.onerror({ preventDefault() {} });
    if (failure === "messageerror") fake.onmessageerror();
    if (failure === "invalid") fake.onmessage({ data: {} });
    fake.onmessage({ data: new Map() });
    assert.equal(await job.promise, null);
    assert.equal(fake.stopped, 1);
  }
  assert.equal(startReachabilityJob({}, () => { throw new Error("Worker unsupported"); }), null);
  const fake = worker();
  fake.postMessage = () => { throw new Error("clone failed"); };
  assert.equal(await startReachabilityJob({}, () => fake).promise, null);
  assert.equal(fake.stopped, 1);
});
