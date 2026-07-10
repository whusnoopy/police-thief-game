import test from "node:test";
import assert from "node:assert/strict";
import { getWinState } from "../src/domain/rules/winResolver.js";

function sessionWithStates(states) {
  return {
    thiefUnits: states.map((state, index) => ({ id: `T${index + 1}`, state })),
  };
}

test("win resolver covers police, thief, mixed, and active outcomes", () => {
  assert.deepStrictEqual(getWinState(sessionWithStates(["CARRIED", "JAILED"])), {
    type: "POLICE",
  });
  assert.deepStrictEqual(getWinState(sessionWithStates(["ESCAPED", "ESCAPED"])), {
    type: "THIEF",
  });
  assert.deepStrictEqual(getWinState(sessionWithStates(["ESCAPED", "JAILED"])), {
    type: "MIXED",
  });
  assert.equal(getWinState(sessionWithStates(["ACTIVE", "JAILED"])), null);
});
