export const GRID_SIZE = 10;

export const SIGNAL_PHASES = {
  PEDESTRIAN_GREEN: "PEDESTRIAN_GREEN",
  PEDESTRIAN_RED: "PEDESTRIAN_RED",
  PEDESTRIAN_GO: "PEDESTRIAN_GREEN",
  CAR_GO: "PEDESTRIAN_RED",
};

export function normalizeSignalPhase(signalPhase) {
  if (signalPhase === SIGNAL_PHASES.PEDESTRIAN_RED || signalPhase === "CAR_GO") {
    return SIGNAL_PHASES.PEDESTRIAN_RED;
  }

  return SIGNAL_PHASES.PEDESTRIAN_GREEN;
}

export const TILE_TYPES = {
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
  CROSSWALK: {
    id: "CROSSWALK",
    name: "旧斑马线",
    emoji: "🚸",
    cost: 1,
    walkable: ["POLICE", "THIEF"],
    hiddenFromPalette: true,
  },
  CROSSWALK_HORIZONTAL: {
    id: "CROSSWALK_HORIZONTAL",
    name: "横向斑马线",
    emoji: "↔️",
    cost: 1,
    walkable: ["POLICE", "THIEF"],
  },
  CROSSWALK_VERTICAL: {
    id: "CROSSWALK_VERTICAL",
    name: "纵向斑马线",
    emoji: "↕️",
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
  PARKING: {
    id: "PARKING",
    name: "停车场",
    emoji: "🅿️",
    cost: 1,
    walkable: ["POLICE", "THIEF"],
  },
  MANHOLE: {
    id: "MANHOLE",
    name: "井盖",
    emoji: "🕳️",
    cost: 1,
    walkable: ["POLICE", "THIEF"],
  },
  TRAFFIC_LIGHT: {
    id: "TRAFFIC_LIGHT",
    name: "旧红绿灯",
    emoji: "🚦",
    cost: 1,
    walkable: ["POLICE", "THIEF"],
    hiddenFromPalette: true,
  },
};
