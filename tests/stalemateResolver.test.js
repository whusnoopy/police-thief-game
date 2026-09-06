import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { isPermanentStalemate } from "../src/domain/rules/stalemateResolver.js";
import { SIGNAL_PHASES } from "../src/config/constants.js";

function trappedSession(exit) {
  const map = createEmptyMapDefinition({ terrain: Array.from({ length: 10 }, () => Array(10).fill("BUILDING")) });
  setLegacyTileAt(map, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(map, 9, 9, "POLICE_SPAWN");
  if (exit) setLegacyTileAt(map, 0, 1, exit);
  return createGameSession(map);
}

test("recognizes permanent immobility", () => {
  assert.equal(isPermanentStalemate(trappedSession()), true);
});

test("does not mistake a low roll, red light, or animal for a permanent stalemate", () => {
  const grass = trappedSession("GRASS");
  grass.diceValue = 1;
  assert.equal(isPermanentStalemate(grass), false);
  const crosswalk = trappedSession("CROSSWALK_HORIZONTAL");
  crosswalk.signalPhase = SIGNAL_PHASES.PEDESTRIAN_RED;
  assert.equal(isPermanentStalemate(crosswalk), false);
  const animal = trappedSession("ROAD");
  animal.animalUnits.push({ id: "A1", r: 0, c: 1 });
  assert.equal(isPermanentStalemate(animal), false);
});
