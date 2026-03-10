import { cloneMapDefinition } from "../map/mapModel.js";
import { getFeaturePositionsByKind } from "../map/mapQueries.js";

export function createGameSession(mapDefinition) {
  const sessionMapDefinition = cloneMapDefinition(mapDefinition);

  const policeUnits = sessionMapDefinition.spawns.police.map((position, index) => ({
    id: `P${index + 1}`,
    r: position.r,
    c: position.c,
    state: "IDLE",
    inCar: false,
  }));

  const thiefUnits = sessionMapDefinition.spawns.thief.map((position, index) => ({
    id: `T${index + 1}`,
    r: position.r,
    c: position.c,
    state: "ACTIVE",
    inCar: false,
    carrierId: null,
  }));

  const parkingCars = new Set();
  getFeaturePositionsByKind(sessionMapDefinition, "PARKING").forEach((position) => {
    parkingCars.add(`${position.r},${position.c}`);
  });
  const parkedCars = new Set(parkingCars);

  return {
    mapDefinition: sessionMapDefinition,
    turn: "THIEF",
    diceValue: 0,
    policeUnits,
    thiefUnits,
    parkingCars,
    parkedCars,
  };
}
