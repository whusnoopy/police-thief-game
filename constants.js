// Constants
const GRID_SIZE = 10;
const TILE_TYPES = {
  GRASS: {
    id: "GRASS",
    name: "草地",
    emoji: "🌿",
    cost: 2,
    walkable: ["POLICE", "THIEF"],
  },
  BUILDING: {
    id: "BUILDING",
    name: "建筑物",
    emoji: "🏢",
    cost: 0,
    walkable: [],
  },
  CONSTRUCTION_SITE: {
    id: "CONSTRUCTION_SITE",
    name: "建筑工地",
    emoji: "🏗️",
    cost: 0,
    walkable: [],
  },
  BARRIER: { id: "BARRIER", name: "路障", emoji: "🚧", cost: 0, walkable: [] },
  ROAD: {
    id: "ROAD",
    name: "道路",
    emoji: "⬜",
    cost: 1,
    walkable: ["POLICE", "THIEF"],
  },
  POLICE_STATION: {
    id: "POLICE_STATION",
    name: "警察局",
    emoji: "🚨",
    cost: 1,
    walkable: ["POLICE"],
  },
  THIEF_BASE: {
    id: "THIEF_BASE",
    name: "小偷基地",
    emoji: "🏚️",
    cost: 1,
    walkable: ["THIEF"],
  },
  POLICE_SPAWN: {
    id: "POLICE_SPAWN",
    name: "警察出生点",
    emoji: "🔵",
    cost: 1,
    walkable: ["POLICE", "THIEF"],
    isSpawn: true,
    owner: "POLICE",
  },
  THIEF_SPAWN: {
    id: "THIEF_SPAWN",
    name: "小偷出生点",
    emoji: "🔴",
    cost: 1,
    walkable: ["POLICE", "THIEF"],
    isSpawn: true,
    owner: "THIEF",
  },
  MANHOLE: {
    id: "MANHOLE",
    name: "井盖",
    emoji: "🕳️",
    cost: 1,
    walkable: ["POLICE", "THIEF"],
  },
};

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const INT_TILE_MAP = [
  "GRASS",
  "BUILDING",
  "BARRIER",
  "ROAD",
  "POLICE_STATION",
  "THIEF_BASE",
  "POLICE_SPAWN",
  "THIEF_SPAWN",
  "MANHOLE",
  "CONSTRUCTION_SITE",
];
const TILE_INT_MAP = INT_TILE_MAP.reduce((acc, val, i) => {
  acc[val] = i;
  return acc;
}, {});
