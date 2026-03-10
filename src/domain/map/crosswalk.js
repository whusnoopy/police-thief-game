import { SIGNAL_PHASES, normalizeSignalPhase } from "../../config/constants.js";

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

export function getAllowedCrosswalkAxis(tileType, isDriving, signalPhase) {
  const orientation = getCrosswalkOrientation(tileType);
  if (!orientation) return null;
  const normalizedSignalPhase = normalizeSignalPhase(signalPhase);

  if (normalizedSignalPhase === SIGNAL_PHASES.PEDESTRIAN_GREEN) {
    if (isDriving) return null;
    return orientation;
  }

  if (!isDriving) return null;
  return orientation === "HORIZONTAL" ? "VERTICAL" : "HORIZONTAL";
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
