import { SIGNAL_PHASES, normalizeSignalPhase } from "../../config/constants.js";
import { resolveAnimalTurn } from "./npcRules.js";

export function getNextSignalPhase(signalPhase) {
  return normalizeSignalPhase(signalPhase) === SIGNAL_PHASES.PEDESTRIAN_GREEN
    ? SIGNAL_PHASES.PEDESTRIAN_RED
    : SIGNAL_PHASES.PEDESTRIAN_GREEN;
}

export function resolveEndOfRoundEffects(session, options = {}) {
  if (!session) {
    return {
      signalChanged: false,
      animalChanged: false,
      boardChanged: false,
    };
  }

  const previousSignalPhase = normalizeSignalPhase(session.signalPhase);
  session.signalPhase = getNextSignalPhase(session.signalPhase);
  const signalChanged = normalizeSignalPhase(session.signalPhase) !== previousSignalPhase;
  const animalChanged = resolveAnimalTurn(session, options).animalChanged;

  return {
    signalChanged,
    animalChanged,
    boardChanged: signalChanged || animalChanged,
  };
}
