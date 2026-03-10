import { getCarriedThiefByCarrier } from "../game/sessionSelectors.js";

function getCoordKey(r, c) {
  return `${r},${c}`;
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

  unit.r = action.to.r;
  unit.c = action.to.c;
  unit.inCar = action.isDriving;

  if (turn === "POLICE") {
    syncCarriedThiefPosition(session, unit);

    if (action.type === "CAPTURE" && unit.state === "IDLE") {
      const caughtThief = getActiveThiefAt(session, action.to.r, action.to.c);
      if (caughtThief) {
        caughtThief.state = "CARRIED";
        caughtThief.carrierId = unit.id;
        caughtThief.r = action.to.r;
        caughtThief.c = action.to.c;
        unit.state = "CARRYING";

        if (caughtThief.inCar) {
          unit.inCar = true;
        }
        caughtThief.inCar = false;
      }
    }

    if (action.type === "DELIVER" && unit.state === "CARRYING") {
      jailCarriedThief(session, unit);
      unit.state = "IDLE";
    }

    syncCarriedThiefPosition(session, unit);
    return;
  }

  if (turn === "THIEF" && action.type === "ESCAPE") {
    if (unit.inCar) {
      session.parkedCars.add(getCoordKey(action.to.r, action.to.c));
      unit.inCar = false;
    }
    unit.state = "ESCAPED";
  }
}
