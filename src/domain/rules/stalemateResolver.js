import { getSignalPhases } from "../map/crosswalk.js";
import { getActiveUnitsForTurn } from "../game/sessionSelectors.js";
import { hasReachableAction } from "./moveGenerator.js";
import { getUnitOperations } from "./unitOperations.js";

export function isPermanentStalemate(session) {
  if (!session?.thiefUnits.some((unit) => unit.state === "ACTIVE")) return false;
  // A low roll, a red light, or a temporary animal obstruction is not a draw.
  // Without a possible action, characters/cars cannot change positions; test
  // the maximum roll in both light phases with temporary animals removed.
  for (const signalPhase of getSignalPhases(session.mapDefinition)) {
    const futureSession = { ...session, signalPhase, animalUnits: [] };
    for (const turn of ["THIEF", "POLICE"]) {
      for (const unit of getActiveUnitsForTurn(session, turn)) {
        if (hasReachableAction({ session: futureSession, turn, unit, diceValue: 6 })) return false;
        if (getUnitOperations({ session: futureSession, turn, unit, movementPoints: 24 }).some(op => op.enabled)) return false;
      }
    }
  }
  return true;
}
