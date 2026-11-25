import { SIGNAL_PHASES, normalizeSignalPhase } from "../../config/constants.js";
import { DIRECTIONAL_SIGNAL_RULES } from "./mapCompatibility.js";
import { isWithinMap } from "./mapDimensions.js";

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

function hasSameCrosswalkAt(mapDefinition, r, c, orientation) {
  if (!mapDefinition || !isWithinMap(mapDefinition, r, c)) return false;
  if ((mapDefinition.features || []).some((feature) => feature.position.r === r && feature.position.c === c)) return false;
  if ((mapDefinition.spawns?.police || []).some((position) => position.r === r && position.c === c)) return false;
  if ((mapDefinition.spawns?.thief || []).some((position) => position.r === r && position.c === c)) return false;
  return getCrosswalkOrientation(mapDefinition.terrain?.[r]?.[c]) === orientation;
}

export function getMergedCrosswalkKeys(mapDefinition, r, c) {
  const keys = new Set();
  if (!mapDefinition || !isWithinMap(mapDefinition, r, c)) return keys;
  const orientation = getCrosswalkOrientation(mapDefinition.terrain?.[r]?.[c]);
  if (!orientation) return keys;
  keys.add(`${r},${c}`);
  if (!hasSameCrosswalkAt(mapDefinition, r, c, orientation)) return keys;
  const [dr, dc] = orientation === "HORIZONTAL" ? [0, 1] : [1, 0];
  for (const sign of [-1, 1]) {
    for (let step = 1; ; step += 1) {
      const nr = r + dr * sign * step;
      const nc = c + dc * sign * step;
      if (!hasSameCrosswalkAt(mapDefinition, nr, nc, orientation)) break;
      keys.add(`${nr},${nc}`);
    }
  }
  return keys;
}

export function getCrosswalkSignalPositions(tileType, context = null) {
  const orientation = getCrosswalkOrientation(tileType);
  if (!orientation) return [];
  const ends = orientation === "HORIZONTAL"
    ? [
        { position: "left", dr: 0, dc: -1 },
        { position: "right", dr: 0, dc: 1 },
      ]
    : [
        { position: "top", dr: -1, dc: 0 },
        { position: "bottom", dr: 1, dc: 0 },
      ];
  if (!context?.mapDefinition || !Number.isInteger(context.r) || !Number.isInteger(context.c)) {
    return ends.map((end) => end.position);
  }
  return ends
    .filter(({ dr, dc }) => !hasSameCrosswalkAt(context.mapDefinition, context.r + dr, context.c + dc, orientation))
    .map((end) => end.position);
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
  fromTileType,
  toTileType,
  isDriving,
  signalPhase,
  dr,
  dc,
  fromStartingCell = false,
  fromInStartingCrosswalk = fromStartingCell,
  toInStartingCrosswalk = false,
}) {
  const from = getCrosswalkOrientation(fromTileType);
  const to = getCrosswalkOrientation(toTileType);
  if (!from && !to) return true;

  const phase = normalizeSignalPhase(signalPhase);
  // A unit already on a crossing may clear its own (possibly merged) crossing
  // along its travel axis after the light changes, in either signal mode.
  // Re-entering from outside or entering another crossing still requires green.
  const canClearFrom = Boolean(fromInStartingCrosswalk);
  const canClearTo = Boolean(fromInStartingCrosswalk && toInStartingCrosswalk && from && from === to);
  return (!from || isStepAlongAxis(dr, dc, getTravelAxis(from, isDriving, phase, canClearFrom))) &&
    (!to || isStepAlongAxis(dr, dc, getTravelAxis(to, isDriving, phase, canClearTo)));
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
