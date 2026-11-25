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

test("stranded units may clear their own merged crossing along their axis, without entering another crossing", () => {
  const map = createNewMapDefinition();
  map.signalRules = DIRECTIONAL_SIGNAL_RULES;
  // (10,10)-(11,10)-(12,10) form one 3-cell merged vertical crosswalk;
  // (8,10) is a separate vertical crosswalk across a road;
  // (10,11) and (10,12) are parallel separate vertical crosswalks.
  for (const [r, c, tile] of [
    [8, 10, "CROSSWALK_VERTICAL"],
    [10, 10, "CROSSWALK_VERTICAL"], [11, 10, "CROSSWALK_VERTICAL"], [12, 10, "CROSSWALK_VERTICAL"],
    [10, 11, "CROSSWALK_VERTICAL"], [10, 12, "CROSSWALK_VERTICAL"],
  ]) setLegacyTileAt(map, r, c, tile);
  const session = createGameSession(map);
  const unit = { id: "T1", r: 10, c: 10, state: "ACTIVE" };
  session.thiefUnits.push(unit);
  const moves = (diceValue = 1) => calculateReachableActions({ session, unit, turn: "THIEF", diceValue });

  session.signalPhase = SIGNAL_PHASES.EAST_WEST_GREEN;
  // From the north cell of the merged crossing, walking can exit north OR continue south through the same crossing.
  assert.deepEqual([...moves(1).keys()].sort(), ["11,10", "9,10"]);
  const cleared = moves(3);
  assert.equal(cleared.has("13,10"), true, "can finish clearing through all cells of the merged crossing");
  assert.equal(cleared.has("8,10"), false, "cannot enter a separate red crossing after clearing onto road");

  // Starting on the middle cell of a 3-cell merged crossing is not trapped and can exit either end.
  unit.r = 11;
  unit.c = 10;
  const fromMiddle = moves(2);
  assert.equal(fromMiddle.has("9,10"), true);
  assert.equal(fromMiddle.has("13,10"), true);
  assert.equal(fromMiddle.has("11,9"), false);
  assert.equal(fromMiddle.has("11,11"), false);

  // Exiting onto road and looping around cannot re-enter the same red crossing from outside.
  const loopMap = createNewMapDefinition();
  loopMap.signalRules = DIRECTIONAL_SIGNAL_RULES;
  setLegacyTileAt(loopMap, 10, 10, "CROSSWALK_VERTICAL");
  setLegacyTileAt(loopMap, 11, 10, "CROSSWALK_VERTICAL");
  setLegacyTileAt(loopMap, 12, 10, "CROSSWALK_VERTICAL");
  const loopSession = createGameSession(loopMap);
  loopSession.signalPhase = SIGNAL_PHASES.EAST_WEST_GREEN;
  // Block the middle cell so the only way to approach (12,10) is exiting north onto road and looping around.
  loopSession.animalUnits.push({ id: "A1", r: 11, c: 10 });
  const loopUnit = { id: "T1", r: 10, c: 10, state: "ACTIVE" };
  loopSession.thiefUnits.push(loopUnit);
  const loopMoves = calculateReachableActions({ session: loopSession, unit: loopUnit, turn: "THIEF", movementPoints: 32 });
  assert.equal(loopMoves.has("13,10"), true, "can exit north and walk around to the south road beside the crossing");
  assert.equal(loopMoves.has("12,10"), false, "cannot re-enter the red crossing from outside road even with points left");

  // Driving on (10,10) when N-S is green can clear west onto road, but cannot enter parallel separate crossings.
  session.signalPhase = SIGNAL_PHASES.NORTH_SOUTH_GREEN;
  unit.r = 10;
  unit.c = 10;
  unit.inCar = true;
  const driving = moves(1);
  assert.ok(driving.has("10,9"));
  assert.equal(driving.has("10,11"), false);
  assert.equal(driving.has("10,12"), false);
  assert.equal(driving.has("9,10"), false);
  assert.equal(driving.has("11,10"), false);

  // Standard synchronous signal mode also allows clearing one's own merged crossing on red.
  const syncMap = createNewMapDefinition();
  for (const [r, c] of [[10, 10], [10, 11], [10, 12]]) setLegacyTileAt(syncMap, r, c, "CROSSWALK_HORIZONTAL");
  const syncSession = createGameSession(syncMap);
  syncSession.signalPhase = SIGNAL_PHASES.PEDESTRIAN_RED;
  const syncUnit = { id: "T1", r: 10, c: 11, state: "ACTIVE", inCar: false };
  syncSession.thiefUnits.push(syncUnit);
  const syncMoves = calculateReachableActions({ session: syncSession, unit: syncUnit, turn: "THIEF", diceValue: 2 });
  assert.equal(syncMoves.has("10,9"), true);
  assert.equal(syncMoves.has("10,13"), true);
  assert.equal(syncMoves.has("9,11"), false);
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
