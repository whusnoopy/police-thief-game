import test from "node:test";
import assert from "node:assert/strict";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { applyResolvedAction } from "../src/domain/rules/interactionResolver.js";
import { calculateReachableActions } from "../src/domain/rules/moveGenerator.js";

function getActionAt(actions, r, c) {
  return actions.get(`${r},${c}`) || null;
}

test("thief can teleport between manholes", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 1, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 1, 1, "MANHOLE");
  setLegacyTileAt(mapDefinition, 4, 4, "MANHOLE");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 2,
    unit: thief,
  });
  const teleportAction = getActionAt(actions, 4, 4);

  assert.ok(teleportAction);
  assert.equal(teleportAction.type, "MOVE");
  assert.equal(teleportAction.movementKind, "TELEPORT");
  assert.equal(teleportAction.costSpent, 4);
});

test("driving thief can stop on base with a half-step left and escape", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "THIEF_BASE");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];
  thief.inCar = true;

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });
  const escapeAction = getActionAt(actions, 0, 1);

  assert.ok(escapeAction);
  assert.equal(escapeAction.type, "ESCAPE");
  assert.equal(escapeAction.isDriving, true);
  assert.equal(escapeAction.pointsLeft, 1);

  applyResolvedAction({
    session,
    turn: "THIEF",
    unit: thief,
    action: escapeAction,
  });

  assert.equal(thief.state, "ESCAPED");
});

test("driving police can capture a driving thief with a half-step left", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "POLICE_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "THIEF_SPAWN");

  const session = createGameSession(mapDefinition);
  const police = session.policeUnits[0];
  const thief = session.thiefUnits[0];
  police.inCar = true;
  thief.inCar = true;

  const actions = calculateReachableActions({
    session,
    turn: "POLICE",
    diceValue: 1,
    unit: police,
  });
  const captureAction = getActionAt(actions, 0, 1);

  assert.ok(captureAction);
  assert.equal(captureAction.type, "CAPTURE");
  assert.equal(captureAction.isDriving, true);
  assert.equal(captureAction.pointsLeft, 1);

  applyResolvedAction({
    session,
    turn: "POLICE",
    unit: police,
    action: captureAction,
  });

  assert.equal(police.state, "CARRYING");
  assert.equal(police.inCar, true);
  assert.equal(thief.state, "CARRIED");
  assert.equal(thief.carrierId, police.id);
  assert.equal(thief.inCar, false);
});
