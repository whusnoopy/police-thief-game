import { getCarriedThiefByCarrier } from "../game/sessionSelectors.js";
import {
  parkAvailableVehicleAt,
  placeVehicle,
  retryPendingVehicles,
} from "./vehiclePlacement.js";

function addAvailableCar(session, r, c) {
  parkAvailableVehicleAt(session, { r, c });
}

function getActionCarPickups(action) {
  if (Array.isArray(action?.carPickups)) return action.carPickups;
  return action?.boardedCarAt ? [action.boardedCarAt] : [];
}

function getActionCarDrops(action) {
  if (Array.isArray(action?.carDrops)) return action.carDrops;
  return action?.droppedCarAt ? [action.droppedCarAt] : [];
}

function returnUnitVehicleToParking(session, unit, action) {
  if (!action.returnsVehicleToParking || !unit.inCar) return;
  placeVehicle(session, { origin: action.to });
  unit.inCar = false;
}

function getActiveThiefAt(session, r, c) {
  return (
    session.thiefUnits.find(
      (thief) => thief.r === r && thief.c === c && thief.state === "ACTIVE",
    ) || null
  );
}

function syncCarriedThiefPosition(session, policeUnit) {
  const carriedThief = getCarriedThiefByCarrier(session, policeUnit.id);
  if (!carriedThief) return;

  carriedThief.r = policeUnit.r;
  carriedThief.c = policeUnit.c;
  carriedThief.inCar = false;
}

function jailCarriedThief(session, policeUnit) {
  const carriedThief = getCarriedThiefByCarrier(session, policeUnit.id);
  if (!carriedThief) return;

  carriedThief.state = "JAILED";
  carriedThief.carrierId = null;
  carriedThief.r = policeUnit.r;
  carriedThief.c = policeUnit.c;
  carriedThief.inCar = false;
}

export function applyResolvedAction({ session, turn, unit, action }) {
  getActionCarPickups(action).forEach((coordKey) => {
    session.parkingCars.delete(coordKey);
    session.parkedCars.delete(coordKey);
  });
  getActionCarDrops(action).forEach((coordKey) => {
    const [r, c] = coordKey.split(",").map(Number);
    addAvailableCar(session, r, c);
  });

  unit.r = action.to.r;
  unit.c = action.to.c;
  unit.inCar = action.isDriving;

  if (turn === "POLICE") {
    syncCarriedThiefPosition(session, unit);

    if (action.type === "CAPTURE" && unit.state === "IDLE") {
      const caughtThief = getActiveThiefAt(session, action.to.r, action.to.c);
      if (caughtThief) {
        const policeHadCar = Boolean(unit.inCar);
        const thiefHadCar = Boolean(caughtThief.inCar);
        caughtThief.state = "CARRIED";
        caughtThief.carrierId = unit.id;
        caughtThief.r = action.to.r;
        caughtThief.c = action.to.c;
        unit.state = "CARRYING";

        if (thiefHadCar) {
          unit.inCar = true;
        }
        caughtThief.inCar = false;

        if (policeHadCar && thiefHadCar) {
          placeVehicle(session, {
            origin: action.to,
            preferredPosition: action.path?.at(-2) || null,
          });
        }
      }
    }

    returnUnitVehicleToParking(session, unit, action);

    if (action.type === "DELIVER" && unit.state === "CARRYING") {
      jailCarriedThief(session, unit);
      unit.state = "IDLE";
    }

    syncCarriedThiefPosition(session, unit);
    retryPendingVehicles(session);
    return;
  }

  if (turn === "THIEF") {
    unit.hasMoney = Boolean(action.hasMoney || unit.hasMoney);
  }

  if (turn === "THIEF" && action.type === "ESCAPE") {
    returnUnitVehicleToParking(session, unit, action);
    unit.state = "ESCAPED";
  }

  retryPendingVehicles(session);
}
