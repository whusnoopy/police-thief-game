import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyMapDefinition, createNewMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { isPermanentStalemate } from "../src/domain/rules/stalemateResolver.js";
import { DIRECTIONAL_SIGNAL_RULES } from "../src/domain/map/mapCompatibility.js";
import { calculateReachableActions } from "../src/domain/rules/moveGenerator.js";
import { getPotentialRoutes } from "../src/domain/rules/mapValidation.js";
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

test("directional lights let stranded units clear their own crossing in either travel mode", () => {
  const map = createNewMapDefinition();
  map.signalRules = DIRECTIONAL_SIGNAL_RULES;
  for (const [r, c, tile] of [
    [10, 10, "CROSSWALK_VERTICAL"], [11, 10, "CROSSWALK_VERTICAL"],
    [10, 12, "CROSSWALK_VERTICAL"], [10, 11, "CROSSWALK_VERTICAL"],
  ]) setLegacyTileAt(map, r, c, tile);
  const session = createGameSession(map);
  const unit = { id: "T1", r: 10, c: 10, state: "ACTIVE" };
  session.thiefUnits.push(unit);
  const moves = () => calculateReachableActions({ session, unit, turn: "THIEF", diceValue: 1 });

  session.signalPhase = SIGNAL_PHASES.EAST_WEST_GREEN;
  assert.deepEqual([...moves().keys()], ["9,10"]);
  session.signalPhase = SIGNAL_PHASES.NORTH_SOUTH_GREEN;
  unit.inCar = true;
  const driving = moves();
  assert.ok(driving.has("10,9"));
  assert.equal(driving.has("10,11"), false);
  assert.equal(driving.has("10,12"), false);
  assert.equal(driving.has("9,10"), false);
});

test("directional map validation and stalemate detection consider a future green light", () => {
  const terrain = Array.from({ length: 20 }, () => Array(20).fill("BUILDING"));
  const map = createEmptyMapDefinition({ meta: { rows: 20, cols: 20 }, signalRules: DIRECTIONAL_SIGNAL_RULES, terrain });
  setLegacyTileAt(map, 10, 10, "THIEF_SPAWN");
  setLegacyTileAt(map, 10, 11, "CROSSWALK_HORIZONTAL");
  const session = createGameSession(map);
  const [unit] = session.thiefUnits;
  assert.equal(session.signalPhase, SIGNAL_PHASES.NORTH_SOUTH_GREEN);
  assert.equal(calculateReachableActions({ session, turn: "THIEF", unit, diceValue: 6 }).size, 0);
  assert.equal(isPermanentStalemate(session), false);
  assert.ok(getPotentialRoutes(map, unit, "THIEF").positions.has("10,11"));
});
