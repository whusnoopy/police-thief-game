import test from "node:test";
import assert from "node:assert/strict";
import { SIGNAL_PHASES } from "../src/config/constants.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
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

test("end-of-round effects move and spawn animals after a full round", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 1, 1, "FARM");
  setLegacyTileAt(mapDefinition, 0, 1, "BUILDING");
  setLegacyTileAt(mapDefinition, 1, 0, "BUILDING");
  setLegacyTileAt(mapDefinition, 1, 2, "BUILDING");

  const session = createGameSession(mapDefinition);
  const result = resolveEndOfRoundEffects(session, {
    rng: () => 0,
    config: {
      ANIMAL_MAX_MOVE_STEPS: 0,
      FARM_MAX_ANIMALS: 3,
    },
    animalEmojis: ["🐷"],
  });

  assert.equal(result.signalChanged, true);
  assert.equal(result.animalChanged, true);
  assert.equal(result.boardChanged, true);
  assert.equal(session.animalUnits.length, 1);
  assert.deepStrictEqual(
    { r: session.animalUnits[0].r, c: session.animalUnits[0].c },
    { r: 2, c: 1 },
  );
});
