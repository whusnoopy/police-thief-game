import test from "node:test";
import assert from "node:assert/strict";
import { BRIDGE_DIRECTIONS, getBridgeWarnings } from "../src/domain/map/bridgeTopology.js";
import { createRampScenario } from "./helpers/rampScenario.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { calculateReachableActions } from "../src/domain/rules/moveGenerator.js";
import { applyResolvedAction } from "../src/domain/rules/interactionResolver.js";
import { getPotentialRoutes, validateMapDefinition } from "../src/domain/rules/mapValidation.js";
import { createMapUpgradeDraft, completeMapUpgrade } from "../src/domain/map/mapUpgrade.js";
import { encodeMapDefinition, decodeMapDefinition } from "../src/domain/map/mapCodec.js";
import { createRampMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { SIGNAL_PHASES } from "../src/config/constants.js";
import { spawnAnimalsNearFarms } from "../src/domain/rules/npcRules.js";

const key = ({ r, c }) => `${r},${c}`;
const moves = (session, unit = session.thiefUnits[0], turn = "THIEF", diceValue = 6) => calculateReachableActions({ session, unit, turn, diceValue });

test("four-direction gameplay traverses both ramps and the bridge with exact costs, preserving money and escape", () => {
  for (const { direction } of BRIDGE_DIRECTIONS) {
    const { map, positions } = createRampScenario(direction);
    assert.equal(validateMapDefinition(map).valid, true);
    const session = createGameSession(map);
    const thief = session.thiefUnits[0];
    thief.inCar = true;
    const actions = moves(session);
    assert.equal(actions.get(key(positions.up)).costSpent, 1);
    assert.equal(actions.get(key(positions.deck)).costSpent, 2);
    assert.equal(actions.get(key(positions.down)).costSpent, 3);
    assert.equal(actions.get(key(positions.end)).costSpent, 5);
    assert.equal(actions.get(key(positions.end)).hasMoney, true);
    const escape = actions.get(key(positions.base));
    assert.equal(escape.type, "ESCAPE");
    assert.equal(escape.costSpent, 7);
    assert.equal(escape.path.length, 6);
  }
});

test("ground beside ordinary bridge and sideways ramp edges never become reachable", () => {
  const { map, positions, put } = createRampScenario();
  put(positions.side, "ROAD");
  const session = createGameSession(map);
  session.thiefUnits[0].inCar = true;
  assert.equal(moves(session).has(key(positions.side)), false);
  // Reverse the uphill ramp: the ground end can no longer enter it.
  setLegacyTileAt(session.mapDefinition, positions.up.r, positions.up.c, "OVERPASS_RAMP_W");
  assert.equal(moves(session).has(key(positions.deck)), false);
  const potential = getPotentialRoutes(session.mapDefinition, positions.start, "THIEF");
  assert.equal(potential.canGetMoney, false);
  assert.equal(validateMapDefinition(session.mapDefinition).valid, false);
});

test("walking, automatic boarding and animal occupancy retain their rules at ramp entrances", () => {
  const { map, positions } = createRampScenario();
  const session = createGameSession(map);
  assert.equal(moves(session).has(key(positions.up)), false);
  const board = moves(session).get(key(positions.parking));
  assert.equal(board.type, "BOARD");
  assert.equal(board.pointsLeft, 0);
  applyResolvedAction({ session, turn: "THIEF", unit: session.thiefUnits[0], action: board });
  assert.equal(moves(session).has(key(positions.deck)), true);
  session.animalUnits.push({ id: "A1", ...positions.up });
  assert.equal(moves(session).has(key(positions.deck)), false);
});

test("farm spawning cannot place animals on any ramp orientation", () => {
  const map = createRampMapDefinition();
  setLegacyTileAt(map, 4, 4, "FARM");
  for (const { direction, dr, dc } of BRIDGE_DIRECTIONS) setLegacyTileAt(map, 4 + dr, 4 + dc, `OVERPASS_RAMP_${direction}`);
  const session = createGameSession(map);
  assert.equal(spawnAnimalsNearFarms(session).spawnedAnimals.length, 0);
});

test("crosswalk permission still applies at a ramp's ground connection", () => {
  const { map, positions } = createRampScenario();
  const session = createGameSession(map);
  const thief = session.thiefUnits[0];
  thief.inCar = true;
  setLegacyTileAt(session.mapDefinition, positions.start.r, positions.start.c, "CROSSWALK_VERTICAL");
  session.signalPhase = SIGNAL_PHASES.PEDESTRIAN_GREEN;
  assert.equal(moves(session).has(key(positions.deck)), false);
  session.signalPhase = SIGNAL_PHASES.PEDESTRIAN_RED;
  assert.equal(moves(session).has(key(positions.deck)), true);
});

test("capture terminates the action on the bridge and does not bypass a disconnected side", () => {
  const { map, positions, put } = createRampScenario();
  put(positions.side, "ROAD");
  const session = createGameSession(map);
  const police = session.policeUnits[0];
  Object.assign(police, positions.start, { inCar: true });
  Object.assign(session.thiefUnits[0], positions.deck, { inCar: true });
  session.parkingCars.clear();
  session.parkedCars.clear();
  const actions = moves(session, police, "POLICE");
  const capture = actions.get(key(positions.deck));
  assert.equal(capture.type, "CAPTURE");
  assert.equal(capture.pointsLeft, 0);
  assert.equal(actions.has(key(positions.end)), false);
  assert.equal(actions.has(key(positions.side)), false);
  applyResolvedAction({ session, turn: "POLICE", unit: police, action: capture });
  assert.equal(police.state, "CARRYING");
  assert.equal(session.parkedCars.has(key(positions.parking)), true);
});

test("parking after a down ramp stops the vehicle only when parking is the final destination", () => {
  const { map, positions, put } = createRampScenario();
  put(positions.end, "PARKING");
  const session = createGameSession(map);
  session.thiefUnits[0].inCar = true;
  session.thiefUnits[0].hasMoney = true;
  session.parkingCars.clear();
  session.parkedCars.clear();
  const actions = moves(session);
  assert.equal(actions.get(key(positions.end)).type, "PARK");
  assert.equal(actions.get(key(positions.base)).type, "ESCAPE");
  applyResolvedAction({ session, turn: "THIEF", unit: session.thiefUnits[0], action: actions.get(key(positions.end)) });
  assert.equal(session.thiefUnits[0].inCar, false);
  assert.equal(session.parkedCars.has(key(positions.end)), true);
});

test("invalid or reversed ramp endpoints block opening; unused isolated bridges produce a warning", () => {
  const { map, positions, put } = createRampScenario();
  put(positions.deck, "ROAD");
  const invalid = validateMapDefinition(map);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((message) => message.includes("高端必须连接")));
  put(positions.deck, "OVERPASS");
  put({ r: 0, c: 0 }, "OVERPASS");
  assert.equal(validateMapDefinition(map).valid, true);
  assert.deepEqual(getBridgeWarnings(map), [{ r: 0, c: 0, reason: "BRIDGE_WITHOUT_ENTRANCE" }]);
});

test("upgrades require actual route validation before completion and preserve the source on success", () => {
  const { map, positions, put } = createRampScenario();
  put(positions.up, "ROAD");
  put(positions.down, "ROAD");
  map.ruleset = "legacy";
  const encodedMap = encodeMapDefinition(map);
  const draft = createMapUpgradeDraft({ encodedMap, mapId: "source" });
  assert.equal(completeMapUpgrade(draft).valid, false);
  setLegacyTileAt(draft, positions.up.r, positions.up.c, "OVERPASS_RAMP_E");
  setLegacyTileAt(draft, positions.down.r, positions.down.c, "OVERPASS_RAMP_W");
  assert.equal(validateMapDefinition(draft).valid, false);
  assert.equal(validateMapDefinition(draft, { allowUpgradeDraft: true }).valid, true);
  const result = completeMapUpgrade(draft);
  assert.equal(result.valid, true);
  assert.equal(result.mapDefinition.upgrade.status, "ready");
  assert.equal(draft.upgrade.status, "pending");
  assert.equal(result.mapDefinition.upgrade.source.encodedMap, encodedMap);
  assert.equal(validateMapDefinition(result.mapDefinition).valid, true);
  assert.deepEqual(decodeMapDefinition(encodedMap).terrain, map.terrain);
});
