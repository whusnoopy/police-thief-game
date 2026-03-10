import { TILE_TYPES } from "../../config/constants.js";
import { getFeatureAt, getSpawnSideAt, getTerrainAt, getTileTypeAt } from "./mapQueries.js";

export function shouldShowMarkerForTileType(tileType) {
  return tileType === "POLICE_SPAWN" || tileType === "THIEF_SPAWN" || (
    tileType !== "GRASS" && tileType !== "ROAD"
  );
}

export function getMarkerEmojiForTileType(tileType) {
  return TILE_TYPES[tileType]?.emoji || "";
}

export function getCellDisplayAt(mapDefinition, r, c) {
  const tileType = getTileTypeAt(mapDefinition, r, c);
  const showMarker = shouldShowMarkerForTileType(tileType);

  return {
    tileType,
    className: `cell type-${tileType}`,
    terrain: getTerrainAt(mapDefinition, r, c),
    feature: getFeatureAt(mapDefinition, r, c),
    spawnSide: getSpawnSideAt(mapDefinition, r, c),
    showMarker,
    markerEmoji: showMarker ? getMarkerEmojiForTileType(tileType) : "",
  };
}
