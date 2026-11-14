import { normalizeSignalPhase } from "../../config/constants.js";
import { getSignalPhases } from "../map/crosswalk.js";
import { resolveAnimalTurn } from "./npcRules.js";

export function resolveEndOfRoundEffects(session, options = {}) {
  if (!session) {
    return {
      signalChanged: false,
      animalChanged: false,
      boardChanged: false,
    };
  }

  const previousSignalPhase = normalizeSignalPhase(session.signalPhase);
  const [first, second] = getSignalPhases(session.mapDefinition);
  session.signalPhase = previousSignalPhase === first ? second : first;
  const signalChanged = session.signalPhase !== previousSignalPhase;
  const animalChanged = resolveAnimalTurn(session, options).animalChanged;
  if (signalChanged || animalChanged) session.revision = (session.revision || 0) + 1;

  return {
    signalChanged,
    animalChanged,
    boardChanged: signalChanged || animalChanged,
  };
}
