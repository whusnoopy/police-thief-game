import test from "node:test";
import assert from "node:assert/strict";
import { SIGNAL_PHASES } from "../src/config/constants.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { createEmptyMapDefinition } from "../src/domain/map/mapModel.js";
import { resolveEndOfRoundEffects } from "../src/domain/rules/endOfRoundEffects.js";

test("end-of-round effects toggle the crosswalk signal phase", () => {
  const session = createGameSession(createEmptyMapDefinition());

  assert.equal(session.signalPhase, SIGNAL_PHASES.PEDESTRIAN_GREEN);

  const firstResult = resolveEndOfRoundEffects(session);
  assert.equal(session.signalPhase, SIGNAL_PHASES.PEDESTRIAN_RED);
  assert.deepStrictEqual(firstResult, {
    signalChanged: true,
    animalChanged: false,
    boardChanged: true,
  });

  const secondResult = resolveEndOfRoundEffects(session);
  assert.equal(session.signalPhase, SIGNAL_PHASES.PEDESTRIAN_GREEN);
  assert.equal(secondResult.boardChanged, true);
});
