import { GRID_SIZE } from "../../src/config/constants.js";
import { getTileTypeAt } from "../../src/domain/map/mapQueries.js";

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const TILE_INT_MAP = {
  GRASS: 0,
  BUILDING: 1,
  BARRIER: 2,
  ROAD: 3,
  POLICE_STATION: 4,
  THIEF_BASE: 5,
  POLICE_SPAWN: 6,
  THIEF_SPAWN: 7,
  MANHOLE: 8,
  CONSTRUCTION_SITE: 9,
  PARKING: 10,
};

function mapDefinitionToLegacyMatrix(mapDefinition) {
  return Array.from({ length: GRID_SIZE }, (_, r) =>
    Array.from({ length: GRID_SIZE }, (_, c) => getTileTypeAt(mapDefinition, r, c)),
  );
}

export function encodeLegacyMapDefinition(mapDefinition) {
  const matrix = mapDefinitionToLegacyMatrix(mapDefinition);
  let chars = "";

  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      chars += BASE64_ALPHABET[TILE_INT_MAP[matrix[r][c]] ?? 0];
    }
  }

  return chars;
}

export function encodeLegacyJsonMapDefinition(mapDefinition) {
  return JSON.stringify(mapDefinitionToLegacyMatrix(mapDefinition));
}
