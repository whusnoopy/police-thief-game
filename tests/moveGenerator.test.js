import test from "node:test";
import assert from "node:assert/strict";
import { SIGNAL_PHASES } from "../src/config/constants.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { applyResolvedAction } from "../src/domain/rules/interactionResolver.js";
import {
  calculateReachableActions,
  formatMovementPoints,
} from "../src/domain/rules/moveGenerator.js";

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
  assert.equal(teleportAction.costSpent, 8);
});

test("unit can stop before spending all rolled movement points", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "ROAD");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 2,
    unit: thief,
  });
  const action = getActionAt(actions, 0, 1);

  assert.ok(action);
  assert.equal(action.costSpent, 4);
  assert.equal(action.pointsLeft, 4);
});

test("walking units cannot enter river or overpass terrain", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "RIVER");
  setLegacyTileAt(mapDefinition, 1, 0, "OVERPASS");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 6,
    unit: thief,
  });

  assert.equal(getActionAt(actions, 0, 1), null);
  assert.equal(getActionAt(actions, 1, 0), null);
});

test("driving units use river and overpass movement costs", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "RIVER");
  setLegacyTileAt(mapDefinition, 1, 0, "OVERPASS");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];
  thief.inCar = true;

  const shortActions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });
  const overpassAction = getActionAt(shortActions, 1, 0);

  assert.equal(getActionAt(shortActions, 0, 1), null);
  assert.ok(overpassAction);
  assert.equal(overpassAction.costSpent, 1);
  assert.equal(overpassAction.pointsLeft, 3);

  const riverAction = getActionAt(calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 2,
    unit: thief,
  }), 0, 1);

  assert.ok(riverAction);
  assert.equal(riverAction.costSpent, 8);
  assert.equal(riverAction.pointsLeft, 0);
});

test("overpass movement search stays bounded on a full board", () => {
  const mapDefinition = createEmptyMapDefinition();
  for (let r = 0; r < 10; r += 1) {
    for (let c = 0; c < 10; c += 1) {
      setLegacyTileAt(mapDefinition, r, c, "OVERPASS");
    }
  }
  setLegacyTileAt(mapDefinition, 5, 5, "THIEF_SPAWN");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];
  thief.inCar = true;

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 6,
    unit: thief,
  });

  assert.equal(actions.size, 99);
});

test("movement point formatter supports quarter-step values", () => {
  assert.equal(formatMovementPoints(1), "0.25");
  assert.equal(formatMovementPoints(2), "0.5");
  assert.equal(formatMovementPoints(3), "0.75");
  assert.equal(formatMovementPoints(5), "1.25");
});

test("driving thief can stop on base with movement points left and escape", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 1, 0, "BANK");
  setLegacyTileAt(mapDefinition, 0, 1, "THIEF_BASE");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];
  thief.inCar = true;
  thief.hasMoney = true;

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
  assert.equal(escapeAction.pointsLeft, 2);

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

test("thief cannot enter the base before stealing money from a bank", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "THIEF_BASE");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });

  assert.equal(getActionAt(actions, 0, 1), null);
});

test("thief can steal money from a bank and escape at the base in one move", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "BANK");
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
  assert.equal(escapeAction.hasMoney, true);

  applyResolvedAction({
    session,
    turn: "THIEF",
    unit: thief,
    action: escapeAction,
  });

  assert.equal(thief.hasMoney, true);
  assert.equal(thief.state, "ESCAPED");
});

test("thief keeps stolen money after ending a move past the bank", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "BANK");
  setLegacyTileAt(mapDefinition, 0, 2, "ROAD");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];

  const action = getActionAt(calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 2,
    unit: thief,
  }), 0, 2);

  assert.ok(action);
  assert.equal(action.hasMoney, true);

  applyResolvedAction({
    session,
    turn: "THIEF",
    unit: thief,
    action,
  });

  assert.equal(thief.hasMoney, true);
  assert.equal(thief.state, "ACTIVE");
});

test("thief leaves the car at base after boarding from parking and escaping", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "PARKING");
  setLegacyTileAt(mapDefinition, 0, 2, "THIEF_BASE");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];
  thief.hasMoney = true;

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
  firstThief.hasMoney = true;

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
  secondThief.hasMoney = true;
  const secondActions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: secondThief,
  });

  assert.equal(getActionAt(secondActions, 0, 1), null);
});

test("driving police can capture a driving thief with movement points left", () => {
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
  assert.equal(captureAction.pointsLeft, 2);

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

test("animals block walking and driving movement", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "ROAD");
  setLegacyTileAt(mapDefinition, 0, 2, "ROAD");

  const session = createGameSession(mapDefinition);
  session.animalUnits.push({ id: "A1", r: 0, c: 1, emoji: "🐷" });
  const thief = session.thiefUnits[0];

  const walkingActions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });

  assert.equal(getActionAt(walkingActions, 0, 1), null);

  thief.inCar = true;
  const drivingActions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  });

  assert.equal(getActionAt(drivingActions, 0, 1), null);
  assert.equal(getActionAt(drivingActions, 0, 2), null);
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
