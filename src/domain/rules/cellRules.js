import { getFeatureAt, getSpawnSideAt, getTerrainAt } from "../map/mapQueries.js";

const TERRAIN_RULES = {
  GRASS: {
    tileType: "GRASS",
    category: "TERRAIN",
    entryCost: 2,
    walkableRoles: ["POLICE", "THIEF"],
    driveCost: null,
  },
  BUILDING: {
    tileType: "BUILDING",
    category: "TERRAIN",
    entryCost: 0,
    walkableRoles: [],
    driveCost: null,
  },
  CONSTRUCTION_SITE: {
    tileType: "CONSTRUCTION_SITE",
    category: "TERRAIN",
    entryCost: 0,
    walkableRoles: [],
    driveCost: null,
  },
  BARRIER: {
    tileType: "BARRIER",
    category: "TERRAIN",
    entryCost: 0,
    walkableRoles: [],
    driveCost: null,
  },
  ROAD: {
    tileType: "ROAD",
    category: "TERRAIN",
    entryCost: 1,
    walkableRoles: ["POLICE", "THIEF"],
    driveCost: 1,
  },
  CROSSWALK: {
    tileType: "CROSSWALK_HORIZONTAL",
    category: "TERRAIN",
    entryCost: 1,
    walkableRoles: ["POLICE", "THIEF"],
    driveCost: 1,
  },
  CROSSWALK_HORIZONTAL: {
    tileType: "CROSSWALK_HORIZONTAL",
    category: "TERRAIN",
    entryCost: 1,
    walkableRoles: ["POLICE", "THIEF"],
    driveCost: 1,
  },
  CROSSWALK_VERTICAL: {
    tileType: "CROSSWALK_VERTICAL",
    category: "TERRAIN",
    entryCost: 1,
    walkableRoles: ["POLICE", "THIEF"],
    driveCost: 1,
  },
};

const FEATURE_RULES = {
  POLICE_STATION: {
    tileType: "POLICE_STATION",
    category: "FEATURE",
    entryCost: 1,
    walkableRoles: ["POLICE"],
    driveCost: 1,
  },
  THIEF_BASE: {
    tileType: "THIEF_BASE",
    category: "FEATURE",
    entryCost: 1,
    walkableRoles: ["THIEF"],
    driveCost: 1,
  },
  PARKING: {
    tileType: "PARKING",
    category: "FEATURE",
    entryCost: 1,
    walkableRoles: ["POLICE", "THIEF"],
    driveCost: 1,
  },
  MANHOLE: {
    tileType: "MANHOLE",
    category: "FEATURE",
    entryCost: 1,
    walkableRoles: ["POLICE", "THIEF"],
    driveCost: 1,
  },
  TRAFFIC_LIGHT: {
    tileType: "TRAFFIC_LIGHT",
    category: "FEATURE",
    entryCost: 1,
    walkableRoles: ["POLICE", "THIEF"],
    driveCost: 1,
  },
};

const SPAWN_RULES = {
  POLICE: {
    tileType: "POLICE_SPAWN",
    category: "SPAWN",
    entryCost: 1,
    walkableRoles: ["POLICE", "THIEF"],
    driveCost: 1,
  },
  THIEF: {
    tileType: "THIEF_SPAWN",
    category: "SPAWN",
    entryCost: 1,
    walkableRoles: ["POLICE", "THIEF"],
    driveCost: 1,
  },
};

export function getCellRuleAt(mapDefinition, r, c) {
  const spawnSide = getSpawnSideAt(mapDefinition, r, c);
  if (spawnSide) return SPAWN_RULES[spawnSide];

  const feature = getFeatureAt(mapDefinition, r, c);
  if (feature) return FEATURE_RULES[feature.kind];

  return TERRAIN_RULES[getTerrainAt(mapDefinition, r, c)] || TERRAIN_RULES.GRASS;
}
