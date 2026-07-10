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

test("units cannot enter mountain terrain when walking or driving", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 2, "MOUNTAIN");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];

  const walkingActions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 3,
    unit: thief,
  });
  assert.equal(getActionAt(walkingActions, 0, 2), null);

  thief.inCar = true;
  const drivingActions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 3,
    unit: thief,
  });
  assert.equal(getActionAt(drivingActions, 0, 2), null);
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

test("driving unit cannot disembark on its current cell or mid-route", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "OVERPASS");
  setLegacyTileAt(mapDefinition, 0, 2, "ROAD");
  setLegacyTileAt(mapDefinition, 0, 3, "GRASS");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];
  thief.inCar = true;

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 3,
    unit: thief,
  });

  assert.equal(getActionAt(actions, 0, 0), null);
  assert.equal(getActionAt(actions, 0, 3), null);
});

test("boarding a car immediately ends the action and consumes remaining movement", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "PARKING");
  setLegacyTileAt(mapDefinition, 0, 2, "GRASS");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 3,
    unit: thief,
  });
  const boardAction = getActionAt(actions, 0, 1);

  assert.ok(boardAction);
  assert.equal(boardAction.type, "BOARD");
  assert.equal(boardAction.boardedCarAt, "0,1");
  assert.equal(boardAction.isDriving, true);
  assert.equal(boardAction.pointsLeft, 0);
  assert.equal(getActionAt(actions, 0, 2), null);

  applyResolvedAction({
    session,
    turn: "THIEF",
    unit: thief,
    action: boardAction,
  });

  assert.equal(thief.inCar, true);
  assert.equal(session.parkingCars.has("0,1"), false);
  assert.equal(session.parkedCars.has("0,1"), false);
});

test("driving unit automatically parks only when an empty parking lot is the destination", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 1, "PARKING");
  const session = createGameSession(mapDefinition);
  session.parkingCars.delete("0,1");
  session.parkedCars.delete("0,1");
  const thief = {
    id: "T1",
    r: 0,
    c: 0,
    state: "ACTIVE",
    inCar: true,
    hasMoney: false,
    carrierId: null,
  };
  session.thiefUnits = [thief];

  const parkAction = getActionAt(calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 1,
    unit: thief,
  }), 0, 1);

  assert.equal(parkAction.type, "PARK");
  assert.equal(parkAction.isDriving, false);
  assert.equal(parkAction.pointsLeft, 0);
  assert.equal(parkAction.droppedCarAt, "0,1");

  applyResolvedAction({ session, turn: "THIEF", unit: thief, action: parkAction });
  assert.equal(thief.inCar, false);
  assert.equal(session.parkingCars.has("0,1"), true);
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
  setLegacyTileAt(mapDefinition, 1, 1, "PARKING");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];
  thief.inCar = true;
  thief.hasMoney = true;
  session.parkingCars.delete("1,1");
  session.parkedCars.delete("1,1");

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
  assert.equal(escapeAction.pointsLeft, 0);
  assert.equal(escapeAction.returnsVehicleToParking, true);

  applyResolvedAction({
    session,
    turn: "THIEF",
    unit: thief,
    action: escapeAction,
  });

  assert.equal(thief.state, "ESCAPED");
  assert.equal(thief.inCar, false);
  assert.equal(session.parkedCars.has("0,1"), false);
  assert.equal(session.parkedCars.has("1,1"), true);
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

test("a thief without money prefers a longer route through the bank to the same destination", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 1, 1, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 2, 2, "BANK");

  const session = createGameSession(mapDefinition);
  const thief = session.thiefUnits[0];
  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 3,
    unit: thief,
  });

  [[1, 2], [2, 1]].forEach(([r, c]) => {
    const action = getActionAt(actions, r, c);

    assert.ok(action);
    assert.equal(action.hasMoney, true);
    assert.equal(action.costSpent, 12);
    assert.equal(action.pointsLeft, 0);
    assert.equal(action.path.some((point) => point.r === 2 && point.c === 2), true);
  });

  const selectedAction = getActionAt(actions, 1, 2);
  applyResolvedAction({ session, turn: "THIEF", unit: thief, action: selectedAction });
  assert.equal(thief.hasMoney, true);
});

test("thief cannot board a car and escape in the same action", () => {
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
  const boardAction = getActionAt(actions, 0, 1);

  assert.ok(boardAction);
  assert.equal(boardAction.type, "BOARD");
  assert.equal(boardAction.pointsLeft, 0);
  assert.equal(getActionAt(actions, 0, 2), null);

  applyResolvedAction({
    session,
    turn: "THIEF",
    unit: thief,
    action: boardAction,
  });

  assert.equal(thief.state, "ACTIVE");
  assert.equal(thief.inCar, true);
  assert.equal(session.parkingCars.has("0,1"), false);
  assert.equal(session.parkedCars.has("0,1"), false);
});

test("vehicles returned from the base never block its entrance", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 1, "THIEF_BASE");
  setLegacyTileAt(mapDefinition, 1, 1, "PARKING");

  const session = createGameSession(mapDefinition);
  session.parkingCars.clear();
  session.parkedCars.clear();
  const firstThief = {
    id: "T1",
    r: 0,
    c: 0,
    state: "ACTIVE",
    inCar: true,
    hasMoney: true,
    carrierId: null,
  };
  session.thiefUnits = [firstThief];
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

  assert.equal(session.parkedCars.has("0,1"), false);
  assert.equal(session.parkedCars.has("1,1"), true);
});

test("driving police capture exhausts movement and keeps the thief car", () => {
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
  assert.equal(captureAction.pointsLeft, 0);

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
  assert.equal(boardDroppedCarAction.type, "BOARD");
  assert.equal(boardDroppedCarAction.isDriving, true);
  assert.equal(boardDroppedCarAction.boardedCarAt, "0,0");
  assert.equal(boardDroppedCarAction.pointsLeft, 0);
});

test("capture takes precedence over automatic parking on an empty parking lot", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "POLICE_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "PARKING");
  setLegacyTileAt(mapDefinition, 1, 1, "THIEF_SPAWN");

  const session = createGameSession(mapDefinition);
  const police = session.policeUnits[0];
  const thief = session.thiefUnits[0];
  police.inCar = true;
  thief.r = 0;
  thief.c = 1;
  session.parkingCars.delete("0,1");
  session.parkedCars.delete("0,1");

  const action = getActionAt(calculateReachableActions({
    session,
    turn: "POLICE",
    diceValue: 1,
    unit: police,
  }), 0, 1);

  assert.ok(action);
  assert.equal(action.type, "CAPTURE");
  assert.equal(action.isDriving, true);
  assert.equal(action.pointsLeft, 0);

  applyResolvedAction({ session, turn: "POLICE", unit: police, action });

  assert.equal(police.state, "CARRYING");
  assert.equal(police.inCar, true);
  assert.equal(thief.state, "CARRIED");
  assert.equal(session.parkedCars.has("0,1"), false);
});

test("driving unit cannot enter a cell that already has an available empty car", () => {
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

test("movement search keeps a longer bank route when the short route consumes a later chokepoint", () => {
  const mapDefinition = createEmptyMapDefinition();
  for (let r = 0; r < 10; r += 1) {
    for (let c = 0; c < 10; c += 1) {
      setLegacyTileAt(mapDefinition, r, c, "BUILDING");
    }
  }
  [[3, 2], [3, 3]].forEach(([r, c]) => setLegacyTileAt(mapDefinition, r, c, "ROAD"));
  [[2, 2], [1, 2], [1, 3], [1, 4], [2, 4]].forEach(([r, c]) =>
    setLegacyTileAt(mapDefinition, r, c, "OVERPASS"));
  setLegacyTileAt(mapDefinition, 3, 4, "BANK");
  setLegacyTileAt(mapDefinition, 4, 3, "THIEF_BASE");

  const session = createGameSession(mapDefinition);
  const thief = {
    id: "T1",
    r: 3,
    c: 2,
    state: "ACTIVE",
    inCar: true,
    hasMoney: false,
    carrierId: null,
  };
  session.thiefUnits = [thief];

  const escapeAction = getActionAt(calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 6,
    unit: thief,
  }), 4, 3);

  assert.ok(escapeAction);
  assert.equal(escapeAction.type, "ESCAPE");
  assert.equal(escapeAction.path.some(({ r, c }) => r === 1 && c === 3), true);
});

test("boarding the first car prevents reaching a second car in the same action", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 1, "PARKING");
  setLegacyTileAt(mapDefinition, 0, 3, "PARKING");
  const session = createGameSession(mapDefinition);
  const thief = {
    id: "T1",
    r: 0,
    c: 0,
    state: "ACTIVE",
    inCar: false,
    hasMoney: false,
    carrierId: null,
  };
  session.thiefUnits = [thief];

  const actions = calculateReachableActions({
    session,
    turn: "THIEF",
    diceValue: 3,
    unit: thief,
  });
  const boardAction = getActionAt(actions, 0, 1);

  assert.equal(boardAction.type, "BOARD");
  assert.equal(boardAction.pointsLeft, 0);
  assert.equal(getActionAt(actions, 0, 3), null);
});

test("an extra captured car on vehicle-only terrain returns to the nearest empty parking", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "OVERPASS");
  setLegacyTileAt(mapDefinition, 2, 0, "PARKING");
  setLegacyTileAt(mapDefinition, 2, 2, "PARKING");
  const session = createGameSession(mapDefinition);
  session.parkingCars.clear();
  session.parkedCars.clear();
  const police = { id: "P1", r: 0, c: 0, state: "IDLE", inCar: true };
  const thief = {
    id: "T1",
    r: 0,
    c: 1,
    state: "ACTIVE",
    inCar: true,
    hasMoney: false,
    carrierId: null,
  };
  session.policeUnits = [police];
  session.thiefUnits = [thief];

  const action = getActionAt(calculateReachableActions({
    session,
    turn: "POLICE",
    diceValue: 1,
    unit: police,
  }), 0, 1);
  applyResolvedAction({ session, turn: "POLICE", unit: police, action });

  assert.equal(session.parkingCars.has("0,0"), false);
  assert.equal(session.parkingCars.has("2,0"), true);
  assert.equal(session.parkingCars.has("2,2"), false);
  assert.equal(session.pendingCars.length, 0);
});

test("a carried thief is jailed when police reaches the station", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 1, "POLICE_STATION");
  const session = createGameSession(mapDefinition);
  const police = { id: "P1", r: 0, c: 0, state: "CARRYING", inCar: false };
  const thief = {
    id: "T1",
    r: 0,
    c: 0,
    state: "CARRIED",
    inCar: false,
    hasMoney: false,
    carrierId: "P1",
  };
  session.policeUnits = [police];
  session.thiefUnits = [thief];

  const action = getActionAt(calculateReachableActions({
    session,
    turn: "POLICE",
    diceValue: 1,
    unit: police,
  }), 0, 1);
  assert.equal(action.type, "DELIVER");

  applyResolvedAction({ session, turn: "POLICE", unit: police, action });

  assert.equal(police.state, "IDLE");
  assert.equal(thief.state, "JAILED");
  assert.equal(thief.carrierId, null);
});
