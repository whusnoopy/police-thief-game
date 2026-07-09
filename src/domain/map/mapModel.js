import { GRID_SIZE } from "../../config/constants.js";
import { normalizeCrosswalkTileType } from "./crosswalk.js";

export const TERRAIN_TILE_TYPES = [
  "GRASS",
  "BUILDING",
  "CONSTRUCTION_SITE",
  "BARRIER",
  "ROAD",
  "CROSSWALK",
  "CROSSWALK_HORIZONTAL",
  "CROSSWALK_VERTICAL",
  "RIVER",
  "OVERPASS",
  "MOUNTAIN",
];

export const FEATURE_TILE_TYPES = [
  "POLICE_STATION",
  "THIEF_BASE",
  "PARKING",
  "MANHOLE",
  "TRAFFIC_LIGHT",
  "BANK",
  "FARM",
];

export const SPAWN_TILE_TYPES = ["POLICE_SPAWN", "THIEF_SPAWN"];
export const DEFAULT_TERRAIN_TILE_TYPE = "ROAD";

const DEFAULT_FEATURE_TERRAIN = {
  POLICE_STATION: "ROAD",
  THIEF_BASE: "ROAD",
  PARKING: "ROAD",
  MANHOLE: "ROAD",
  TRAFFIC_LIGHT: "ROAD",
  BANK: "ROAD",
  FARM: "ROAD",
};

const TILE_TO_SPAWN_KEY = {
  POLICE_SPAWN: "police",
  THIEF_SPAWN: "thief",
};

const ORTHOGONAL_DIRECTIONS = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];

export function isWithinBounds(r, c) {
  return r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;
}

export function createEmptyTerrainMatrix() {
  return Array(GRID_SIZE)
    .fill()
    .map(() => Array(GRID_SIZE).fill(DEFAULT_TERRAIN_TILE_TYPE));
}

export function createEmptyMapDefinition(overrides = {}) {
  return normalizeMapDefinition({
    version: 2,
    meta: {
      name: "",
      rows: GRID_SIZE,
      cols: GRID_SIZE,
      ...(overrides.meta || {}),
    },
    terrain: createEmptyTerrainMatrix(),
    features: [],
    spawns: {
      police: [],
      thief: [],
    },
    ...overrides,
  });
}

export function cloneMapDefinition(mapDefinition) {
  return normalizeMapDefinition(JSON.parse(JSON.stringify(mapDefinition)));
}

export function positionToIndex(position) {
  return position.r * GRID_SIZE + position.c;
}

export function indexToPosition(index) {
  return {
    r: Math.floor(index / GRID_SIZE),
    c: index % GRID_SIZE,
  };
}

function normalizePosition(position = {}) {
  const r = Number(position.r);
  const c = Number(position.c);
  if (!Number.isInteger(r) || !Number.isInteger(c) || !isWithinBounds(r, c)) {
    return null;
  }
  return { r, c };
}

function getOrthogonalPositions(r, c) {
  return ORTHOGONAL_DIRECTIONS
    .map(([dr, dc]) => ({ r: r + dr, c: c + dc }))
    .filter((position) => isWithinBounds(position.r, position.c));
}

function hasFeatureAt(mapDefinition, r, c) {
  return (mapDefinition?.features || []).some(
    (feature) => feature.position.r === r && feature.position.c === c,
  );
}

function hasSpawnAt(mapDefinition, r, c) {
  return (
    (mapDefinition?.spawns?.police || []).some((position) => position.r === r && position.c === c) ||
    (mapDefinition?.spawns?.thief || []).some((position) => position.r === r && position.c === c)
  );
}

function hasCellDecoratorAt(mapDefinition, r, c) {
  return hasFeatureAt(mapDefinition, r, c) || hasSpawnAt(mapDefinition, r, c);
}

function getPlacementPositionKey(position) {
  return `${position.r},${position.c}`;
}

function uniquePositions(positions) {
  const seen = new Set();
  return positions.filter((position) => {
    const key = getPlacementPositionKey(position);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isMountainTerrainAt(mapDefinition, r, c) {
  return mapDefinition?.terrain?.[r]?.[c] === "MOUNTAIN";
}

function isRequiredGrassForMountain(mapDefinition, r, c) {
  return getOrthogonalPositions(r, c).some((position) =>
    isMountainTerrainAt(mapDefinition, position.r, position.c),
  );
}

function createPlacementPlan({
  canPlace,
  placements,
  previewPositions,
  blockers = [],
}) {
  return {
    canPlace,
    placements,
    previewPositions: previewPositions || placements.map(({ r, c }) => ({ r, c })),
    blockers,
  };
}

function getMountainPlacementPlan(mapDefinition, r, c) {
  const neighborPositions = getOrthogonalPositions(r, c);
  const affectedPositions = uniquePositions([{ r, c }, ...neighborPositions]);
  const blockers = [];

  affectedPositions.forEach((position) => {
    if (hasCellDecoratorAt(mapDefinition, position.r, position.c)) {
      blockers.push({
        ...position,
        reason: "SPECIAL_CELL",
      });
      return;
    }

    if (
      (position.r !== r || position.c !== c) &&
      isMountainTerrainAt(mapDefinition, position.r, position.c)
    ) {
      blockers.push({
        ...position,
        reason: "MOUNTAIN_BUFFER",
      });
    }
  });

  return createPlacementPlan({
    canPlace: blockers.length === 0,
    placements: [
      { r, c, tileType: "MOUNTAIN" },
      ...neighborPositions.map((position) => ({ ...position, tileType: "GRASS" })),
    ],
    previewPositions: affectedPositions,
    blockers,
  });
}

export function getTilePlacementPlan(mapDefinition, r, c, tileType) {
  const normalizedTileType = normalizeCrosswalkTileType(tileType);

  if (!isWithinBounds(r, c)) {
    return createPlacementPlan({
      canPlace: false,
      placements: [],
      previewPositions: [],
      blockers: [{ r, c, reason: "OUT_OF_BOUNDS" }],
    });
  }

  if (normalizedTileType === "MOUNTAIN") {
    return getMountainPlacementPlan(mapDefinition, r, c);
  }

  const blockers = [];
  if (normalizedTileType !== "GRASS" && isRequiredGrassForMountain(mapDefinition, r, c)) {
    blockers.push({ r, c, reason: "MOUNTAIN_BUFFER" });
  }

  return createPlacementPlan({
    canPlace: blockers.length === 0,
    placements: [{ r, c, tileType }],
    blockers,
  });
}

function normalizeTerrainMatrix(terrain) {
  const normalized = createEmptyTerrainMatrix();
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      const tileType = normalizeCrosswalkTileType(terrain?.[r]?.[c]);
      normalized[r][c] = TERRAIN_TILE_TYPES.includes(tileType)
        ? tileType
        : DEFAULT_TERRAIN_TILE_TYPE;
    }
  }
  return normalized;
}

function normalizeFeatures(features) {
  if (!Array.isArray(features)) return [];

  return features
    .map((feature, index) => {
      const kind = feature?.kind;
      const position = normalizePosition(feature?.position || feature?.at);
      if (!FEATURE_TILE_TYPES.includes(kind) || !position) return null;

      return {
        id: feature.id || `feature_${kind}_${position.r}_${position.c}_${index}`,
        kind,
        position,
        config: feature.config || {},
      };
    })
    .filter(Boolean);
}

function normalizeSpawnList(spawnList) {
  if (!Array.isArray(spawnList)) return [];
  return spawnList.map(normalizePosition).filter(Boolean);
}

export function normalizeMapDefinition(mapDefinition = {}) {
  return {
    version: 2,
    meta: {
      name: mapDefinition.meta?.name || "",
      rows: GRID_SIZE,
      cols: GRID_SIZE,
    },
    terrain: normalizeTerrainMatrix(mapDefinition.terrain),
    features: normalizeFeatures(mapDefinition.features),
    spawns: {
      police: normalizeSpawnList(mapDefinition.spawns?.police),
      thief: normalizeSpawnList(mapDefinition.spawns?.thief),
    },
  };
}

function clearCellDecorators(mapDefinition, r, c) {
  mapDefinition.features = mapDefinition.features.filter(
    (feature) => feature.position.r !== r || feature.position.c !== c,
  );
  mapDefinition.spawns.police = mapDefinition.spawns.police.filter(
    (position) => position.r !== r || position.c !== c,
  );
  mapDefinition.spawns.thief = mapDefinition.spawns.thief.filter(
    (position) => position.r !== r || position.c !== c,
  );
}

export function setLegacyTileAt(mapDefinition, r, c, tileType) {
  if (!isWithinBounds(r, c)) return mapDefinition;

  if (!mapDefinition.terrain) {
    Object.assign(mapDefinition, createEmptyMapDefinition());
  }
  mapDefinition.features ||= [];
  mapDefinition.spawns ||= { police: [], thief: [] };
  mapDefinition.spawns.police ||= [];
  mapDefinition.spawns.thief ||= [];
  mapDefinition.terrain[r] ||= Array(GRID_SIZE).fill(DEFAULT_TERRAIN_TILE_TYPE);

  const placementPlan = getTilePlacementPlan(mapDefinition, r, c, tileType);
  if (!placementPlan.canPlace) return mapDefinition;

  if (normalizeCrosswalkTileType(tileType) === "MOUNTAIN") {
    placementPlan.placements.forEach((placement) => {
      clearCellDecorators(mapDefinition, placement.r, placement.c);
      mapDefinition.terrain[placement.r][placement.c] = placement.tileType;
    });
    return mapDefinition;
  }

  clearCellDecorators(mapDefinition, r, c);

  if (TERRAIN_TILE_TYPES.includes(tileType)) {
    mapDefinition.terrain[r][c] = tileType;
    return mapDefinition;
  }

  if (SPAWN_TILE_TYPES.includes(tileType)) {
    mapDefinition.terrain[r][c] = "ROAD";
    const spawnKey = TILE_TO_SPAWN_KEY[tileType];
    mapDefinition.spawns[spawnKey].push({ r, c });
    return mapDefinition;
  }

  if (FEATURE_TILE_TYPES.includes(tileType)) {
    mapDefinition.terrain[r][c] = DEFAULT_FEATURE_TERRAIN[tileType] || "ROAD";
    mapDefinition.features.push({
      id: `feature_${tileType}_${r}_${c}`,
      kind: tileType,
      position: { r, c },
      config: {},
    });
    return mapDefinition;
  }

  mapDefinition.terrain[r][c] = "GRASS";
  return mapDefinition;
}

export function legacyTileMatrixToMapDefinition(tileMatrix) {
  const mapDefinition = createEmptyMapDefinition();

  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      setLegacyTileAt(mapDefinition, r, c, tileMatrix?.[r]?.[c] || "GRASS");
    }
  }

  return mapDefinition;
}
