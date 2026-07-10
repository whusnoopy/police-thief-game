import { getFeatureAt, getSpawnSideAt, getTerrainAt } from "../map/mapQueries.js";

const QUARTER_STEP_COST = 1;
const HALF_STEP_COST = 2;
const ONE_STEP_COST = 4;
const TWO_STEP_COST = 8;

const TERRAIN_RULES = {
  GRASS: {
    tileType: "GRASS",
    category: "TERRAIN",
    walkCost: TWO_STEP_COST,
    walkableRoles: ["POLICE", "THIEF"],
    drivableRoles: [],
    driveCost: null,
  },
  BUILDING: {
    tileType: "BUILDING",
    category: "TERRAIN",
    walkCost: null,
    walkableRoles: [],
    drivableRoles: [],
    driveCost: null,
  },
  CONSTRUCTION_SITE: {
    tileType: "CONSTRUCTION_SITE",
    category: "TERRAIN",
    walkCost: null,
    walkableRoles: [],
    drivableRoles: [],
    driveCost: null,
  },
  BARRIER: {
    tileType: "BARRIER",
    category: "TERRAIN",
    walkCost: null,
    walkableRoles: [],
    drivableRoles: [],
    driveCost: null,
  },
  ROAD: {
    tileType: "ROAD",
    category: "TERRAIN",
    walkCost: ONE_STEP_COST,
    walkableRoles: ["POLICE", "THIEF"],
    drivableRoles: ["POLICE", "THIEF"],
    driveCost: HALF_STEP_COST,
  },
  RIVER: {
    tileType: "RIVER",
    category: "TERRAIN",
    walkCost: null,
    walkableRoles: [],
    drivableRoles: ["POLICE", "THIEF"],
    driveCost: TWO_STEP_COST,
  },
  OVERPASS: {
    tileType: "OVERPASS",
    category: "TERRAIN",
    walkCost: null,
    walkableRoles: [],
    drivableRoles: ["POLICE", "THIEF"],
    driveCost: QUARTER_STEP_COST,
  },
  MOUNTAIN: {
    tileType: "MOUNTAIN",
    category: "TERRAIN",
    walkCost: null,
    walkableRoles: [],
    drivableRoles: [],
    driveCost: null,
  },
  CROSSWALK: {
    tileType: "CROSSWALK_HORIZONTAL",
    category: "TERRAIN",
    walkCost: ONE_STEP_COST,
    walkableRoles: ["POLICE", "THIEF"],
    drivableRoles: ["POLICE", "THIEF"],
    driveCost: HALF_STEP_COST,
  },
  CROSSWALK_HORIZONTAL: {
    tileType: "CROSSWALK_HORIZONTAL",
    category: "TERRAIN",
    walkCost: ONE_STEP_COST,
    walkableRoles: ["POLICE", "THIEF"],
    drivableRoles: ["POLICE", "THIEF"],
    driveCost: HALF_STEP_COST,
  },
  CROSSWALK_VERTICAL: {
    tileType: "CROSSWALK_VERTICAL",
    category: "TERRAIN",
    walkCost: ONE_STEP_COST,
    walkableRoles: ["POLICE", "THIEF"],
    drivableRoles: ["POLICE", "THIEF"],
    driveCost: HALF_STEP_COST,
  },
};

const FEATURE_RULES = {
  POLICE_STATION: {
    tileType: "POLICE_STATION",
    category: "FEATURE",
    walkCost: ONE_STEP_COST,
    walkableRoles: ["POLICE"],
    drivableRoles: ["POLICE"],
    driveCost: HALF_STEP_COST,
  },
  THIEF_BASE: {
    tileType: "THIEF_BASE",
    category: "FEATURE",
    walkCost: ONE_STEP_COST,
    walkableRoles: ["THIEF"],
    drivableRoles: ["THIEF"],
    driveCost: HALF_STEP_COST,
  },
  BANK: {
    tileType: "BANK",
    category: "FEATURE",
    walkCost: ONE_STEP_COST,
    walkableRoles: ["POLICE", "THIEF"],
    drivableRoles: ["POLICE", "THIEF"],
    driveCost: HALF_STEP_COST,
  },
  FARM: {
    tileType: "FARM",
    category: "FEATURE",
    walkCost: ONE_STEP_COST,
    walkableRoles: ["POLICE", "THIEF"],
    drivableRoles: ["POLICE", "THIEF"],
    driveCost: HALF_STEP_COST,
  },
  PARKING: {
    tileType: "PARKING",
    category: "FEATURE",
    walkCost: ONE_STEP_COST,
    walkableRoles: ["POLICE", "THIEF"],
    drivableRoles: ["POLICE", "THIEF"],
    driveCost: HALF_STEP_COST,
  },
  MANHOLE: {
    tileType: "MANHOLE",
    category: "FEATURE",
    walkCost: ONE_STEP_COST,
    walkableRoles: ["POLICE", "THIEF"],
    drivableRoles: ["POLICE", "THIEF"],
    driveCost: HALF_STEP_COST,
  },
  TRAFFIC_LIGHT: {
    tileType: "TRAFFIC_LIGHT",
    category: "FEATURE",
    walkCost: ONE_STEP_COST,
    walkableRoles: ["POLICE", "THIEF"],
    drivableRoles: ["POLICE", "THIEF"],
    driveCost: HALF_STEP_COST,
  },
};

const SPAWN_RULES = {
  POLICE: {
    tileType: "POLICE_SPAWN",
    category: "SPAWN",
    walkCost: ONE_STEP_COST,
    walkableRoles: ["POLICE", "THIEF"],
    drivableRoles: ["POLICE", "THIEF"],
    driveCost: HALF_STEP_COST,
  },
  THIEF: {
    tileType: "THIEF_SPAWN",
    category: "SPAWN",
    walkCost: ONE_STEP_COST,
    walkableRoles: ["POLICE", "THIEF"],
    drivableRoles: ["POLICE", "THIEF"],
    driveCost: HALF_STEP_COST,
  },
};

export function getCellRuleAt(mapDefinition, r, c) {
  const spawnSide = getSpawnSideAt(mapDefinition, r, c);
  if (spawnSide) return SPAWN_RULES[spawnSide];

  const feature = getFeatureAt(mapDefinition, r, c);
  if (feature) return FEATURE_RULES[feature.kind];

  return TERRAIN_RULES[getTerrainAt(mapDefinition, r, c)] || TERRAIN_RULES.GRASS;
}
