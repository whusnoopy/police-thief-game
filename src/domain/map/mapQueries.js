export function getTerrainAt(mapDefinition, r, c) {
  return mapDefinition?.terrain?.[r]?.[c] || "GRASS";
}

export function getFeatureAt(mapDefinition, r, c) {
  return (
    mapDefinition?.features?.find(
      (feature) => feature.position.r === r && feature.position.c === c,
    ) || null
  );
}

export function getSpawnSideAt(mapDefinition, r, c) {
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
    .filter((feature) => feature.kind === kind)
    .map((feature) => ({ ...feature.position }));
}
