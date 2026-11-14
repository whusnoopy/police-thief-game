import { SIGNAL_PHASES, normalizeSignalPhase } from "../../config/constants.js";
import { DIRECTIONAL_SIGNAL_RULES } from "./mapCompatibility.js";

const STANDARD_PHASES = Object.freeze([SIGNAL_PHASES.PEDESTRIAN_GREEN, SIGNAL_PHASES.PEDESTRIAN_RED]);
const DIRECTIONAL_PHASES = Object.freeze([SIGNAL_PHASES.NORTH_SOUTH_GREEN, SIGNAL_PHASES.EAST_WEST_GREEN]);

export function getSignalPhases(mapDefinition) {
  return mapDefinition.signalRules === DIRECTIONAL_SIGNAL_RULES ? DIRECTIONAL_PHASES : STANDARD_PHASES;
}

export const LEGACY_CROSSWALK_TILE_TYPE = "CROSSWALK";
export const CROSSWALK_HORIZONTAL_TILE_TYPE = "CROSSWALK_HORIZONTAL";
export const CROSSWALK_VERTICAL_TILE_TYPE = "CROSSWALK_VERTICAL";

export function normalizeCrosswalkTileType(tileType) {
  if (tileType === LEGACY_CROSSWALK_TILE_TYPE) {
    return CROSSWALK_HORIZONTAL_TILE_TYPE;
  }

  return tileType;
}

export function getCrosswalkOrientation(tileType) {
  const normalizedTileType = normalizeCrosswalkTileType(tileType);

  if (normalizedTileType === CROSSWALK_HORIZONTAL_TILE_TYPE) {
    return "HORIZONTAL";
  }

  if (normalizedTileType === CROSSWALK_VERTICAL_TILE_TYPE) {
    return "VERTICAL";
  }

  return null;
}

export function isCrosswalkTileType(tileType) {
  return getCrosswalkOrientation(tileType) !== null;
}

export function getCrosswalkSignalPositions(tileType) {
  const orientation = getCrosswalkOrientation(tileType);
  if (orientation === "HORIZONTAL") {
    return ["left", "right"];
  }

  if (orientation === "VERTICAL") {
    return ["top", "bottom"];
  }

  return [];
}

function isPedestrianGreen(orientation, phase) {
  switch (phase) {
    case SIGNAL_PHASES.NORTH_SOUTH_GREEN: return orientation === "VERTICAL";
    case SIGNAL_PHASES.EAST_WEST_GREEN: return orientation === "HORIZONTAL";
    default: return phase === SIGNAL_PHASES.PEDESTRIAN_GREEN;
  }
}

export function isCrosswalkPedestrianGreen(tileType, signalPhase) {
  const orientation = getCrosswalkOrientation(tileType);
  return !!orientation && isPedestrianGreen(orientation, normalizeSignalPhase(signalPhase));
}

function getTravelAxis(orientation, isDriving, phase, canClear = false) {
  if (!orientation || (!canClear && isPedestrianGreen(orientation, phase) === isDriving)) return null;
  if (!isDriving) return orientation;
  return orientation === "HORIZONTAL" ? "VERTICAL" : "HORIZONTAL";
}

export function getAllowedCrosswalkAxis(tileType, isDriving, signalPhase) {
  return getTravelAxis(getCrosswalkOrientation(tileType), isDriving, normalizeSignalPhase(signalPhase));
}

export function canTakeCrosswalkStep({
  fromTileType, toTileType, isDriving, signalPhase, dr, dc, fromStartingCell,
}) {
  const from = getCrosswalkOrientation(fromTileType);
  const to = getCrosswalkOrientation(toTileType);
  if (!from && !to) return true;

  const phase = normalizeSignalPhase(signalPhase);
  // A unit already on the crossing may clear it after the light changes.
  // Entry into another crossing still requires that crossing's green phase.
  const canClear = fromStartingCell && DIRECTIONAL_PHASES.includes(phase);
  return (!from || isStepAlongAxis(dr, dc, getTravelAxis(from, isDriving, phase, canClear))) &&
    (!to || isStepAlongAxis(dr, dc, getTravelAxis(to, isDriving, phase)));
}

export function isStepAlongAxis(dr, dc, axis) {
  if (axis === "HORIZONTAL") {
    return dr === 0 && Math.abs(dc) === 1;
  }

  if (axis === "VERTICAL") {
    return dc === 0 && Math.abs(dr) === 1;
  }

  return false;
}
