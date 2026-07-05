import { getCarriedThiefByCarrier } from "../game/sessionSelectors.js";

function getCoordKey(r, c) {
  return `${r},${c}`;
}

function addAvailableCar(session, r, c) {
  const coordKey = getCoordKey(r, c);
  session.parkingCars.add(coordKey);
  session.parkedCars.add(coordKey);
}

function getPreviousStepPosition(action) {
  if (!Array.isArray(action?.path) || action.path.length < 2) return null;
  return action.path[action.path.length - 2] || null;
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
  if (action.boardedCarAt) {
    session.parkingCars.delete(action.boardedCarAt);
    session.parkedCars.delete(action.boardedCarAt);
  }
  if (action.droppedCarAt) {
    const [r, c] = action.droppedCarAt.split(",").map(Number);
    addAvailableCar(session, r, c);
  }

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
          const previousStep = getPreviousStepPosition(action);
          if (previousStep) {
            addAvailableCar(session, previousStep.r, previousStep.c);
          }
        }
      }
    }

    if (action.type === "DELIVER" && unit.state === "CARRYING") {
      jailCarriedThief(session, unit);
      unit.state = "IDLE";
    }

    syncCarriedThiefPosition(session, unit);
    return;
  }

  if (turn === "THIEF") {
    unit.hasMoney = Boolean(action.hasMoney || unit.hasMoney);
  }

  if (turn === "THIEF" && action.type === "ESCAPE") {
    if (unit.inCar) {
      session.parkedCars.add(getCoordKey(action.to.r, action.to.c));
      unit.inCar = false;
    }
    unit.state = "ESCAPED";
  }
}
