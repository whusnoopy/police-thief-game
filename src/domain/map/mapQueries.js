import { DEFAULT_TERRAIN_TILE_TYPE } from "./mapModel.js";
import { isWithinMap } from "./mapDimensions.js";

export function getTerrainAt(mapDefinition, r, c) {
  if (!isWithinMap(mapDefinition, r, c)) return "VOID";
  return mapDefinition?.terrain?.[r]?.[c] || DEFAULT_TERRAIN_TILE_TYPE;
}

export function getFeatureAt(mapDefinition, r, c) {
  if (!isWithinMap(mapDefinition, r, c)) return null;
  return (
    mapDefinition?.features?.find(
      (feature) => feature.position.r === r && feature.position.c === c,
    ) || null
  );
}

export function getSpawnSideAt(mapDefinition, r, c) {
  if (!isWithinMap(mapDefinition, r, c)) return null;
  if (
    mapDefinition?.spawns?.police?.some((position) => position.r === r && position.c === c)
  ) {
    return "POLICE";
  }
  if (
    mapDefinition?.spawns?.thief?.some((position) => position.r === r && position.c === c)
  ) {
    return "THIEF";
  }
  return null;
}

export function getTileTypeAt(mapDefinition, r, c) {
  const spawnSide = getSpawnSideAt(mapDefinition, r, c);
  if (spawnSide === "POLICE") return "POLICE_SPAWN";
  if (spawnSide === "THIEF") return "THIEF_SPAWN";

  const feature = getFeatureAt(mapDefinition, r, c);
  if (feature) return feature.kind;

  return getTerrainAt(mapDefinition, r, c);
}

export function getFeaturePositionsByKind(mapDefinition, kind) {
  return (mapDefinition?.features || [])
    .filter((feature) => feature.kind === kind && isWithinMap(mapDefinition, feature.position.r, feature.position.c))
    .map((feature) => ({ ...feature.position }));
}
