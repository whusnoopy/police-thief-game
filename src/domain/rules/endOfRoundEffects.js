import { SIGNAL_PHASES, normalizeSignalPhase } from "../../config/constants.js";

export function getNextSignalPhase(signalPhase) {
  return normalizeSignalPhase(signalPhase) === SIGNAL_PHASES.PEDESTRIAN_GREEN
    ? SIGNAL_PHASES.PEDESTRIAN_RED
    : SIGNAL_PHASES.PEDESTRIAN_GREEN;
}

export function resolveEndOfRoundEffects(session) {
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

  return {
    signalChanged,
    animalChanged: false,
    boardChanged: signalChanged,
  };
}
