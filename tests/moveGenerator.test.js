import test from "node:test";
import assert from "node:assert/strict";
import { SIGNAL_PHASES } from "../src/config/constants.js";
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
  assert.equal(thief.inCar, false);
  assert.equal(session.parkedCars.has("0,1"), true);
});

test("thief leaves the car at base after boarding from parking and escaping", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "PARKING");
  setLegacyTileAt(mapDefinition, 0, 2, "THIEF_BASE");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 2,
    unit: thief,
  });
  const escapeAction = getActionAt(actions, 0, 2);

  assert.ok(escapeAction);
  assert.equal(escapeAction.type, "ESCAPE");
  assert.equal(escapeAction.boardedCarAt, "0,1");
  assert.equal(session.parkingCars.has("0,1"), true);
  assert.equal(session.parkedCars.has("0,1"), true);

  applyResolvedAction({
    session,
    turn: "THIEF",
    unit: thief,
    action: escapeAction,
  });

  assert.equal(thief.state, "ESCAPED");
  assert.equal(thief.inCar, false);
  assert.equal(session.parkingCars.has("0,1"), false);
  assert.equal(session.parkedCars.has("0,1"), false);
  assert.equal(session.parkedCars.has("0,2"), true);
});

test("driving thief cannot escape into a base that already has a parked empty car", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 1, 1, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "THIEF_BASE");

  const session = createGameSession(mapDefinition);
  const firstThief = session.thiefUnits[0];
  const secondThief = session.thiefUnits[1];
  firstThief.inCar = true;

  const firstEscapeAction = getActionAt(calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: firstThief,
  }), 0, 1);

  assert.ok(firstEscapeAction);

  applyResolvedAction({
    session,
    turn: "THIEF",
    unit: firstThief,
    action: firstEscapeAction,
  });

  assert.equal(session.parkedCars.has("0,1"), true);
  assert.equal(session.parkingCars.has("0,1"), false);

  secondThief.inCar = true;
  const secondActions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: secondThief,
  });

  assert.equal(getActionAt(secondActions, 0, 1), null);
});

test("driving police can capture a driving thief with a half-step left", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "POLICE_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 1, 0, "THIEF_SPAWN");

  const session = createGameSession(mapDefinition);
  const police = session.policeUnits[0];
  const thief = session.thiefUnits[0];
  const otherThief = session.thiefUnits[1];
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
  assert.equal(session.parkingCars.has("0,0"), true);
  assert.equal(session.parkedCars.has("0,0"), true);

  const boardDroppedCarAction = getActionAt(calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: otherThief,
  }), 0, 0);

  assert.ok(boardDroppedCarAction);
  assert.equal(boardDroppedCarAction.isDriving, true);
  assert.equal(boardDroppedCarAction.boardedCarAt, "0,0");
});

test("driving unit cannot move onto a cell that already has an available empty car", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "PARKING");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];
  thief.inCar = true;

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });

  assert.equal(getActionAt(actions, 0, 1), null);
});

test("walking unit can enter horizontal crosswalk from left or right during pedestrian phase", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "CROSSWALK_HORIZONTAL");

  const session = createGameSession(mapDefinition);
  session.signalPhase = SIGNAL_PHASES.PEDESTRIAN_GREEN;
  const thief = session.thiefUnits[0];

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });

  assert.ok(getActionAt(actions, 0, 1));
});

test("walking unit cannot enter horizontal crosswalk vertically even during pedestrian phase", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 1, 0, "CROSSWALK_HORIZONTAL");

  const session = createGameSession(mapDefinition);
  session.signalPhase = SIGNAL_PHASES.PEDESTRIAN_GREEN;
  const thief = session.thiefUnits[0];

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });

  assert.equal(getActionAt(actions, 1, 0), null);
});

test("walking unit cannot enter vertical crosswalk during pedestrian red", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 1, 0, "CROSSWALK_VERTICAL");

  const session = createGameSession(mapDefinition);
  session.signalPhase = SIGNAL_PHASES.PEDESTRIAN_RED;
  const thief = session.thiefUnits[0];

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });

  assert.equal(getActionAt(actions, 1, 0), null);
});

test("driving unit can enter vertical crosswalk from left or right during pedestrian red", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "ROAD");
  setLegacyTileAt(mapDefinition, 0, 2, "CROSSWALK_VERTICAL");

  const session = createGameSession(mapDefinition);
  session.signalPhase = SIGNAL_PHASES.PEDESTRIAN_RED;
  const thief = session.thiefUnits[0];
  thief.inCar = true;

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });

  assert.ok(getActionAt(actions, 0, 2));
});

test("driving unit cannot enter vertical crosswalk vertically during pedestrian red", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 1, 0, "CROSSWALK_VERTICAL");

  const session = createGameSession(mapDefinition);
  session.signalPhase = SIGNAL_PHASES.PEDESTRIAN_RED;
  const thief = session.thiefUnits[0];
  thief.inCar = true;

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });

  assert.equal(getActionAt(actions, 1, 0), null);
});

test("unit standing on a horizontal crosswalk cannot leave it vertically", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "CROSSWALK_HORIZONTAL");
  setLegacyTileAt(mapDefinition, 1, 1, "ROAD");

  const session = createGameSession(mapDefinition);
  session.signalPhase = SIGNAL_PHASES.PEDESTRIAN_GREEN;
  const thief = session.thiefUnits[0];
  thief.r = 0;
  thief.c = 1;

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });

  assert.equal(getActionAt(actions, 1, 1), null);
});

test("walking unit cannot enter horizontal crosswalk during pedestrian red", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "CROSSWALK_HORIZONTAL");

  const session = createGameSession(mapDefinition);
  session.signalPhase = SIGNAL_PHASES.PEDESTRIAN_RED;
  const thief = session.thiefUnits[0];

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });

  assert.equal(getActionAt(actions, 0, 1), null);
});

test("walking unit cannot enter vertical crosswalk sideways in any signal state", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "CROSSWALK_VERTICAL");

  const session = createGameSession(mapDefinition);
  session.signalPhase = SIGNAL_PHASES.PEDESTRIAN_GREEN;
  const thief = session.thiefUnits[0];

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });

  assert.equal(getActionAt(actions, 0, 1), null);
});

test("driving unit cannot enter horizontal crosswalk along its direction in any signal state", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "ROAD");
  setLegacyTileAt(mapDefinition, 0, 2, "CROSSWALK_HORIZONTAL");

  const session = createGameSession(mapDefinition);
  session.signalPhase = SIGNAL_PHASES.PEDESTRIAN_RED;
  const thief = session.thiefUnits[0];
  thief.inCar = true;

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });

  assert.equal(getActionAt(actions, 0, 2), null);
});

test("driving unit cannot enter vertical crosswalk during pedestrian green", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "ROAD");
  setLegacyTileAt(mapDefinition, 0, 2, "CROSSWALK_VERTICAL");

  const session = createGameSession(mapDefinition);
  session.signalPhase = SIGNAL_PHASES.PEDESTRIAN_GREEN;
  const thief = session.thiefUnits[0];
  thief.inCar = true;

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });

  assert.equal(getActionAt(actions, 0, 2), null);
});
