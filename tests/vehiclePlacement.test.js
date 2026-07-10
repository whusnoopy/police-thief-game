import test from "node:test";
import assert from "node:assert/strict";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { applyResolvedAction } from "../src/domain/rules/interactionResolver.js";
import { calculateReachableActions } from "../src/domain/rules/moveGenerator.js";
import {
  placeVehicle,
} from "../src/domain/rules/vehiclePlacement.js";

test("vehicle placement uses Manhattan distance and row-column tie breaking", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 2, 0, "PARKING");
  setLegacyTileAt(mapDefinition, 2, 2, "PARKING");
  const session = createGameSession(mapDefinition);
  session.parkingCars.clear();
  session.parkedCars.clear();

  const result = placeVehicle(session, { origin: { r: 0, c: 1 } });

  assert.deepStrictEqual(result, {
    status: "PARKED",
    position: { r: 2, c: 0 },
  });
});

test("a vehicle waits off-board while every car-free parking lot is occupied", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "PARKING");
  const session = createGameSession(mapDefinition);
  session.parkingCars.clear();
  session.parkedCars.clear();
  session.policeUnits = [{ id: "P1", r: 0, c: 0, state: "IDLE", inCar: false }];

  const result = placeVehicle(session, { origin: { r: 1, c: 0 } });
  assert.equal(result.status, "PENDING");
  assert.equal(session.pendingCars.length, 1);

  const moveAction = calculateReachableActions({
    session,
    turn: "POLICE",
    diceValue: 1,
    unit: session.policeUnits[0],
  }).get("1,0");
  applyResolvedAction({
    session,
    turn: "POLICE",
    unit: session.policeUnits[0],
    action: moveAction,
  });

  assert.equal(session.pendingCars.length, 0);
  assert.equal(session.parkingCars.has("0,0"), true);
});

test("driving into the police station returns the vehicle and delivers the thief", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 1, "POLICE_STATION");
  setLegacyTileAt(mapDefinition, 0, 2, "PARKING");
  const session = createGameSession(mapDefinition);
  session.parkingCars.clear();
  session.parkedCars.clear();
  const police = { id: "P1", r: 0, c: 0, state: "CARRYING", inCar: true };
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

  const action = calculateReachableActions({
    session,
    turn: "POLICE",
    diceValue: 1,
    unit: police,
  }).get("0,1");

  assert.equal(action.type, "DELIVER");
  assert.equal(action.pointsLeft, 0);
  assert.equal(action.returnsVehicleToParking, true);

  applyResolvedAction({ session, turn: "POLICE", unit: police, action });

  assert.equal(police.state, "IDLE");
  assert.equal(police.inCar, false);
  assert.equal(thief.state, "JAILED");
  assert.equal(session.parkingCars.has("0,2"), true);
  assert.equal(session.parkedCars.has("0,1"), false);
});

test("idle driving police also returns the vehicle when entering the station", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 1, "POLICE_STATION");
  setLegacyTileAt(mapDefinition, 0, 2, "PARKING");
  const session = createGameSession(mapDefinition);
  session.parkingCars.clear();
  session.parkedCars.clear();
  const police = { id: "P1", r: 0, c: 0, state: "IDLE", inCar: true };
  session.policeUnits = [police];

  const action = calculateReachableActions({
    session,
    turn: "POLICE",
    diceValue: 1,
    unit: police,
  }).get("0,1");

  assert.equal(action.type, "ENTER_STATION");
  assert.equal(action.pointsLeft, 0);
  applyResolvedAction({ session, turn: "POLICE", unit: police, action });

  assert.equal(police.state, "IDLE");
  assert.equal(police.inCar, false);
  assert.equal(session.parkingCars.has("0,2"), true);
});
