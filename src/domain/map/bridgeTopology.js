import { GRID_SIZE } from "../../config/constants.js";

// Directions refer to the map, regardless of the camera. A ramp points uphill.
export const BRIDGE_DIRECTIONS = Object.freeze([
  Object.freeze({ direction: "N", dr: -1, dc: 0, arrow: "↑", name: "北" }),
  Object.freeze({ direction: "E", dr: 0, dc: 1, arrow: "→", name: "东" }),
  Object.freeze({ direction: "S", dr: 1, dc: 0, arrow: "↓", name: "南" }),
  Object.freeze({ direction: "W", dr: 0, dc: -1, arrow: "←", name: "西" }),
]);
export const RAMP_TILE_TYPES = Object.freeze(BRIDGE_DIRECTIONS.map(({ direction }) => `OVERPASS_RAMP_${direction}`));
const RAMP_GROUND_TYPES = new Set(["ROAD", "CROSSWALK", "CROSSWALK_HORIZONTAL", "CROSSWALK_VERTICAL"]);

export function getRampDirection(tileType) {
  const index = RAMP_TILE_TYPES.indexOf(tileType);
  return index < 0 ? null : BRIDGE_DIRECTIONS[index];
}

export function isRampTileType(tileType) {
  return RAMP_TILE_TYPES.includes(tileType);
}

export function isBridgeTileType(tileType) {
  return tileType === "OVERPASS" || isRampTileType(tileType);
}

export function getSurfaceHeight(tileType) {
  return tileType === "OVERPASS" ? 1 : isRampTileType(tileType) ? 0.5 : 0;
}

function isInBounds({ r, c }) {
  return Number.isInteger(r) && Number.isInteger(c) && r >= 0 && c >= 0 && r < GRID_SIZE && c < GRID_SIZE;
}

function edgeHeight(tileType, dr, dc) {
  if (tileType === "OVERPASS") return 1;
  const ramp = getRampDirection(tileType);
  if (!ramp) return 0;
  if (dr === ramp.dr && dc === ramp.dc) return 1;
  if (dr === -ramp.dr && dc === -ramp.dc) return 0;
  return null;
}

// Geometry only: role, driving mode, signals, occupants and costs remain separate
// checks. Both ends must agree on the surface level at their shared edge.
export function areCellsConnected(mapDefinition, from, to) {
  if (!isInBounds(from) || !isInBounds(to)) return false;
  const dr = to.r - from.r;
  const dc = to.c - from.c;
  if (Math.abs(dr) + Math.abs(dc) !== 1) return false;
  const fromType = mapDefinition.terrain?.[from.r]?.[from.c];
  const toType = mapDefinition.terrain?.[to.r]?.[to.c];
  if (!fromType || !toType) return false;
  if (isRampTileType(fromType) && isRampTileType(toType)) return false;
  if (isRampTileType(fromType) && !isBridgeTileType(toType) && !RAMP_GROUND_TYPES.has(toType)) return false;
  if (isRampTileType(toType) && !isBridgeTileType(fromType) && !RAMP_GROUND_TYPES.has(fromType)) return false;
  const fromHeight = edgeHeight(fromType, dr, dc);
  const toHeight = edgeHeight(toType, -dr, -dc);
  return fromHeight !== null && toHeight !== null && fromHeight === toHeight;
}

export function getBridgeConnectionMask(mapDefinition, r, c) {
  if (!isBridgeTileType(mapDefinition.terrain?.[r]?.[c])) return 0;
  return BRIDGE_DIRECTIONS.reduce((mask, { dr, dc }, index) => (
    areCellsConnected(mapDefinition, { r, c }, { r: r + dr, c: c + dc }) ? mask | (1 << index) : mask
  ), 0);
}

export function getRampConnectionIssues(mapDefinition) {
  const issues = [];
  for (let r = 0; r < GRID_SIZE; r += 1) for (let c = 0; c < GRID_SIZE; c += 1) {
    const ramp = getRampDirection(mapDefinition.terrain?.[r]?.[c]);
    if (!ramp) continue;
    for (const [sign, reason] of [[1, "RAMP_HIGH_END"], [-1, "RAMP_LOW_END"]]) {
      const neighbor = { r: r + sign * ramp.dr, c: c + sign * ramp.dc };
      if (!areCellsConnected(mapDefinition, { r, c }, neighbor)) issues.push({ r, c, reason, neighbor });
    }
  }
  return issues;
}
