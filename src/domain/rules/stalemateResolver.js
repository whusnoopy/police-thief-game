import { SIGNAL_PHASES } from "../../config/constants.js";
import { getActiveUnitsForTurn } from "../game/sessionSelectors.js";
import { calculateReachableActions } from "./moveGenerator.js";

export function isPermanentStalemate(session) {
  if (!session?.thiefUnits.some((unit) => unit.state === "ACTIVE")) return false;
  // A low roll, a red light, or a temporary animal obstruction is not a draw.
  // Without a possible action, characters/cars cannot change positions; test
  // the maximum roll in both light phases with temporary animals removed.
  for (const signalPhase of [SIGNAL_PHASES.PEDESTRIAN_GREEN, SIGNAL_PHASES.PEDESTRIAN_RED]) {
    const futureSession = { ...session, signalPhase, animalUnits: [] };
    for (const turn of ["THIEF", "POLICE"]) {
      for (const unit of getActiveUnitsForTurn(session, turn)) {
        if (calculateReachableActions({ session: futureSession, turn, unit, diceValue: 6 }).size) return false;
      }
    }
  }
  return true;
}
