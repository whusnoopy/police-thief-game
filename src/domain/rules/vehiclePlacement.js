import { getUnitAt, hasAnimalAt, hasParkedCar } from "../game/sessionSelectors.js";
import { getFeaturePositionsByKind } from "../map/mapQueries.js";
import { getCellRuleAt } from "./cellRules.js";

function getCoordKey(r, c) {
  return `${r},${c}`;
}

function isUnoccupied(session, position) {
  return (
    !hasParkedCar(session, position.r, position.c) &&
    !getUnitAt(session, position.r, position.c) &&
    !hasAnimalAt(session, position.r, position.c)
  );
}

function canUsePreferredCell(session, position) {
  if (!position || !isUnoccupied(session, position)) return false;
  const cellRule = getCellRuleAt(session.mapDefinition, position.r, position.c);
  return cellRule.driveCost !== null && cellRule.walkableRoles.length > 0;
}

function getDistance(origin, position) {
  return Math.abs(origin.r - position.r) + Math.abs(origin.c - position.c);
}

export function parkAvailableVehicleAt(session, position) {
  const coordKey = getCoordKey(position.r, position.c);
  session.parkingCars.add(coordKey);
  session.parkedCars.add(coordKey);
}

export function findNearestAvailableParking(session, origin) {
  return (
    getFeaturePositionsByKind(session.mapDefinition, "PARKING")
      .filter((position) => isUnoccupied(session, position))
      .sort((a, b) => (
        getDistance(origin, a) - getDistance(origin, b) ||
        a.r - b.r ||
        a.c - b.c
      ))[0] || null
  );
}

export function placeVehicle(session, { origin, preferredPosition = null } = {}) {
  if (canUsePreferredCell(session, preferredPosition)) {
    parkAvailableVehicleAt(session, preferredPosition);
    return { status: "PARKED", position: preferredPosition };
  }

  const parkingPosition = findNearestAvailableParking(session, origin);
  if (parkingPosition) {
    parkAvailableVehicleAt(session, parkingPosition);
    return { status: "PARKED", position: parkingPosition };
  }

  session.pendingCars ||= [];
  session.pendingCars.push({ origin: { ...origin } });
  return { status: "PENDING", position: null };
}

export function retryPendingVehicles(session) {
  const pendingCars = session?.pendingCars || [];
  if (pendingCars.length === 0) return { parked: [], pendingCount: 0 };

  const stillPending = [];
  const parked = [];
  pendingCars.forEach((pendingCar) => {
    const parkingPosition = findNearestAvailableParking(session, pendingCar.origin);
    if (!parkingPosition) {
      stillPending.push(pendingCar);
      return;
    }
    parkAvailableVehicleAt(session, parkingPosition);
    parked.push(parkingPosition);
  });
  session.pendingCars = stillPending;
  return { parked, pendingCount: stillPending.length };
}
