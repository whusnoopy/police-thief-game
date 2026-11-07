import { GRID_SIZE } from "../../config/constants.js";
import {
  DEFAULT_TERRAIN_TILE_TYPE,
  FEATURE_TILE_TYPES,
  createEmptyMapDefinition,
  createEmptyTerrainMatrix,
  indexToPosition,
  legacyTileMatrixToMapDefinition,
  normalizeMapDefinition,
  positionToIndex,
} from "./mapModel.js";
import { MAP_RULESETS, normalizeMapCompatibility } from "./mapCompatibility.js";
import { isBridgeTileType, isRampTileType } from "./bridgeTopology.js";

import { getMapDimensions, isWithinMap } from "./mapDimensions.js";

const V5_MAP_DEFINITION_PREFIX = "v5.";
const V4_MAP_DEFINITION_PREFIX = "v4.";
const V3_MAP_DEFINITION_PREFIX = "v3.";
const V2_MAP_DEFINITION_PREFIX = "v2.";
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// These codes are persistence contracts. Never derive them from array order or
// reuse a retired value; new tile types must receive a new explicit code.
const LEGACY_TERRAIN_CODE_BY_TYPE = Object.freeze({
  GRASS: 0,
  BUILDING: 1,
  CONSTRUCTION_SITE: 2,
  BARRIER: 3,
  ROAD: 4,
  CROSSWALK: 5,
  CROSSWALK_HORIZONTAL: 6,
  CROSSWALK_VERTICAL: 7,
  RIVER: 8,
  OVERPASS: 9,
  MOUNTAIN: 10,
});
const TERRAIN_CODE_BY_TYPE = Object.freeze({
  ...LEGACY_TERRAIN_CODE_BY_TYPE,
  OVERPASS_RAMP_N: 11,
  OVERPASS_RAMP_E: 12,
  OVERPASS_RAMP_S: 13,
  OVERPASS_RAMP_W: 14,
  VOID: 15,
});
// v2 used array indices. Freeze that historical order before adding any tiles.
const V2_TERRAIN_TYPES = Object.freeze(Object.keys(LEGACY_TERRAIN_CODE_BY_TYPE));
const LEGACY_TERRAIN_TYPE_BY_CODE = Object.freeze(
  Object.fromEntries(Object.entries(LEGACY_TERRAIN_CODE_BY_TYPE).map(([type, code]) => [code, type])),
);
const FEATURE_CODE_BY_TYPE = Object.freeze({
  POLICE_STATION: 0,
  THIEF_BASE: 1,
  PARKING: 2,
  MANHOLE: 3,
  TRAFFIC_LIGHT: 4,
  BANK: 5,
  FARM: 6,
});
const TERRAIN_TYPE_BY_CODE = Object.freeze(
  Object.fromEntries(Object.entries(TERRAIN_CODE_BY_TYPE).map(([type, code]) => [code, type])),
);
const FEATURE_TYPE_BY_CODE = Object.freeze(
  Object.fromEntries(Object.entries(FEATURE_CODE_BY_TYPE).map(([type, code]) => [code, type])),
);
const LEGACY_INT_TILE_MAP = [
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
  "PARKING",
];

function encodeBytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64UrlToBytes(base64Url) {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeJsonPayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return encodeBytesToBase64Url(bytes);
}

function decodeJsonPayload(encodedPayload) {
  const bytes = decodeBase64UrlToBytes(encodedPayload);
  return JSON.parse(new TextDecoder().decode(bytes));
}

function validateJsonPayload(payload, version) {
  const terrainTypes = version === 2 ? V2_TERRAIN_TYPES : version === 3 ? LEGACY_TERRAIN_TYPE_BY_CODE : TERRAIN_TYPE_BY_CODE;
  const featureTypes = version === 2 ? FEATURE_TILE_TYPES : FEATURE_TYPE_BY_CODE;
  const dimensions = version === 5 ? getMapDimensions({ meta: { rows: payload?.d?.[0], cols: payload?.d?.[1] } }) : { rows: GRID_SIZE, cols: GRID_SIZE };
  if (version === 5 && (!Array.isArray(payload?.d) || payload.d.length !== 2 || payload.a !== "single" || !Object.values(MAP_RULESETS).includes(payload.b))) {
    throw new Error("Invalid map payload: unsupported dimensions or action rules");
  }
  if (version < 5 && ["d", "a", "x", "s"].some(key => payload?.[key] !== undefined)) throw new Error("Invalid map payload: dimensions and action rules require v5");
  if (version === 5 && payload.s !== (dimensions.rows === 20 ? "cut3" : "square")) throw new Error("Invalid map payload: unsupported map shape");
  const cellCount = dimensions.rows * dimensions.cols;
  const validIndex = (value) => Number.isInteger(value) && value >= 0 && value < cellCount &&
    isWithinMap({ meta: dimensions }, Math.floor(value / dimensions.cols), value % dimensions.cols);
  if (
    !payload || payload.v !== version || typeof payload.t !== "string" ||
    // Old v2 saves sometimes carried extra trailing terrain characters.
    (version === 2 ? payload.t.length < cellCount : payload.t.length !== cellCount) ||
    [...payload.t].some((char) => !terrainTypes[BASE64_ALPHABET.indexOf(char)]) ||
    !Array.isArray(payload.f) || !Array.isArray(payload.p) || !Array.isArray(payload.h) ||
    !payload.p.every(validIndex) || !payload.h.every(validIndex) ||
    !payload.f.every((entry) => Array.isArray(entry) && Number.isInteger(entry[0]) &&
      featureTypes[entry[0]] && validIndex(entry[1]) &&
      (version === 2 || ((entry[2] === undefined || (entry[2] !== null && typeof entry[2] === "object" && !Array.isArray(entry[2]))) &&
        (entry[3] === undefined || typeof entry[3] === "string"))))
  ) throw new Error("Invalid map payload: incomplete or unsupported map data");
  for (let index = 0; index < cellCount; index += 1) {
    const isVoid = terrainTypes[BASE64_ALPHABET.indexOf(payload.t[index])] === "VOID";
    if (isVoid === validIndex(index)) throw new Error("Invalid map payload: terrain does not match map shape");
  }
  const occupied = [...payload.p, ...payload.h, ...payload.f.map((entry) => entry[1])];
  if (new Set(occupied).size !== occupied.length) throw new Error("Invalid map payload: overlapping cells");
  if (version >= 4) {
    if (payload.b === MAP_RULESETS.RAMPS && occupied.some((index) => isBridgeTileType(terrainTypes[BASE64_ALPHABET.indexOf(payload.t[index])]))) {
      throw new Error("Invalid map payload: facilities and spawns cannot occupy a bridge");
    }
    if ((version === 4 && payload.b !== MAP_RULESETS.RAMPS) ||
        (payload.m !== undefined && (!payload.m || typeof payload.m !== "object" || Array.isArray(payload.m) ||
          (payload.m.n !== undefined && typeof payload.m.n !== "string")))) {
      throw new Error("Invalid map payload: unsupported ramp rules or metadata");
    }
    if (payload.b === MAP_RULESETS.LEGACY && [...payload.t].some(char => isRampTileType(terrainTypes[BASE64_ALPHABET.indexOf(char)]))) throw new Error("Ramp terrain requires ramp rules");
    normalizeMapCompatibility({ ruleset: payload.b, upgrade: payload.u, ...(version === 5 ? { meta: dimensions, actionRules: payload.a, expansion: payload.x } : {}) });
    if (payload.x) validateExpansionSource(payload.x);
    validateUpgradeSource(payload.u);
  } else if (payload.b !== undefined || payload.u !== undefined) {
    throw new Error("Invalid map payload: ramp rules require v4");
  }
}

function validateUpgradeSource(upgrade) {
  if (upgrade === undefined) return;
  // A source is an original old-format snapshot, never another upgrade draft.
  // Legacy v5 expansion snapshots are allowed; nested upgrade sources are not.
  if ((upgrade.source.encodedMap.startsWith(V4_MAP_DEFINITION_PREFIX) ||
       (upgrade.source.encodedMap.startsWith(V5_MAP_DEFINITION_PREFIX) && decodeJsonPayload(upgrade.source.encodedMap.slice(3)).u !== undefined)) ||
      decodeMapDefinition(upgrade.source.encodedMap).ruleset !== MAP_RULESETS.LEGACY) {
    throw new Error("Invalid map upgrade source");
  }
}

function validateExpansionSource(expansion) {
  const encoded = expansion.source.encodedMap;
  if (encoded.startsWith(V5_MAP_DEFINITION_PREFIX) && decodeJsonPayload(encoded.slice(3)).x !== undefined) throw new Error("Invalid map expansion source: nested expansion");
  const source = decodeMapDefinition(encoded);
  if (getMapDimensions(source).rows !== 10 || source.expansion) throw new Error("Invalid map expansion source");
}

function encodeTerrainMatrix(terrainMatrix, { rows, cols }) {
  let chars = "";
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const terrainType = terrainMatrix[r][c];
      chars += BASE64_ALPHABET[TERRAIN_CODE_BY_TYPE[terrainType] ?? 0];
    }
  }
  return chars;
}

function decodeTerrainMatrix(chars, typeByCode = TERRAIN_TYPE_BY_CODE, dimensions = { rows: GRID_SIZE, cols: GRID_SIZE }) {
  const terrainMatrix = createEmptyTerrainMatrix(dimensions);
  let index = 0;
  for (let r = 0; r < dimensions.rows; r += 1) {
    for (let c = 0; c < dimensions.cols; c += 1) {
      if (index < chars.length) {
        const b6 = BASE64_ALPHABET.indexOf(chars[index]);
        terrainMatrix[r][c] = typeByCode[b6] || DEFAULT_TERRAIN_TILE_TYPE;
      }
      index += 1;
    }
  }
  return terrainMatrix;
}

export function isMapDefinitionEncodedMap(encodedMap) {
  return (
    typeof encodedMap === "string" &&
    (encodedMap.startsWith(V5_MAP_DEFINITION_PREFIX) || encodedMap.startsWith(V4_MAP_DEFINITION_PREFIX) ||
      encodedMap.startsWith(V3_MAP_DEFINITION_PREFIX) ||
      encodedMap.startsWith(V2_MAP_DEFINITION_PREFIX))
  );
}

export function isLegacyEncodedMap(encodedMap) {
  return (
    typeof encodedMap === "string" &&
    (encodedMap.length === 50 || encodedMap.length === 100) &&
    /^[A-Za-z0-9_-]+$/.test(encodedMap)
  );
}

export function encodeMapDefinition(mapDefinition) {
  const normalized = normalizeMapDefinition(mapDefinition);
  const isRampMap = normalized.ruleset === MAP_RULESETS.RAMPS;
  const dimensions = getMapDimensions(normalized);
  const version = dimensions.rows !== 10 || normalized.actionRules || normalized.expansion ? 5 : isRampMap ? 4 : 3;
  if (!isRampMap && normalized.terrain.some((row) => row.some(isRampTileType))) {
    throw new Error("Ramp terrain requires ramp rules and v4 encoding");
  }
  const payload = {
    v: version,
    t: encodeTerrainMatrix(normalized.terrain, dimensions),
    f: normalized.features.map((feature) => [
      FEATURE_CODE_BY_TYPE[feature.kind],
      positionToIndex(feature.position, normalized),
      feature.config || {},
      feature.id,
    ]),
    p: normalized.spawns.police.map(p => positionToIndex(p, normalized)),
    h: normalized.spawns.thief.map(p => positionToIndex(p, normalized)),
    m: normalized.meta.name ? { n: normalized.meta.name } : undefined,
    ...(version >= 4 ? { b: normalized.ruleset, ...(normalized.upgrade ? { u: normalized.upgrade } : {}) } : {}),
    ...(version === 5 ? { d: [dimensions.rows, dimensions.cols], s: dimensions.rows === 20 ? "cut3" : "square", a: normalized.actionRules || "single", ...(normalized.expansion ? { x: normalized.expansion } : {}) } : {}),
  };
  validateJsonPayload(payload, version);
  return `v${version}.${encodeJsonPayload(payload)}`;
}

function decodeV2MapDefinition(encodedMap) {
  const payload = decodeJsonPayload(encodedMap.slice(V2_MAP_DEFINITION_PREFIX.length));
  validateJsonPayload(payload, 2);
  const mapDefinition = createEmptyMapDefinition();
  mapDefinition.terrain = decodeTerrainMatrix(payload.t || "", V2_TERRAIN_TYPES);
  mapDefinition.features = Array.isArray(payload.f)
    ? payload.f
        .map(([kindIndex, positionIndex], index) => {
          const kind = FEATURE_TILE_TYPES[kindIndex];
          const position = indexToPosition(positionIndex);
          if (!kind) return null;
          return {
            id: `feature_${kind}_${position.r}_${position.c}_${index}`,
            kind,
            position,
            config: {},
          };
        })
        .filter(Boolean)
    : [];
  mapDefinition.spawns.police = Array.isArray(payload.p)
    ? payload.p.map(index => indexToPosition(index))
    : [];
  mapDefinition.spawns.thief = Array.isArray(payload.h)
    ? payload.h.map(index => indexToPosition(index))
    : [];
  return normalizeMapDefinition(mapDefinition);
}

function decodeModernMapDefinition(encodedMap, version) {
  const payload = decodeJsonPayload(encodedMap.slice(3));
  validateJsonPayload(payload, version);
  const dimensions = version === 5 ? { rows: payload.d[0], cols: payload.d[1] } : { rows: GRID_SIZE, cols: GRID_SIZE };
  const mapDefinition = createEmptyMapDefinition({
    ruleset: version >= 4 ? payload.b : MAP_RULESETS.LEGACY,
    ...(version >= 4 && payload.u !== undefined ? { upgrade: payload.u } : {}),
    ...(version === 5 ? { actionRules: payload.a, ...(payload.x ? { expansion: payload.x } : {}) } : {}),
    meta: {
      name: typeof payload.m?.n === "string" ? payload.m.n : "",
      ...dimensions,
    },
  });
  mapDefinition.terrain = decodeTerrainMatrix(payload.t || "", TERRAIN_TYPE_BY_CODE, dimensions);
  mapDefinition.features = Array.isArray(payload.f)
    ? payload.f
        .map(([kindCode, positionIndex, config, id], index) => {
          const kind = FEATURE_TYPE_BY_CODE[kindCode];
          const position = indexToPosition(positionIndex, mapDefinition);
          if (!kind) return null;
          return {
            id:
              typeof id === "string" && id
                ? id
                : `feature_${kind}_${position.r}_${position.c}_${index}`,
            kind,
            position,
            config:
              config && typeof config === "object" && !Array.isArray(config) ? config : {},
          };
        })
        .filter(Boolean)
    : [];
  mapDefinition.spawns.police = Array.isArray(payload.p)
    ? payload.p.map(index => indexToPosition(index, mapDefinition))
    : [];
  mapDefinition.spawns.thief = Array.isArray(payload.h)
    ? payload.h.map(index => indexToPosition(index, mapDefinition))
    : [];
  return normalizeMapDefinition(mapDefinition);
}

function decodeLegacyUrlSafeBase64ToTileMatrix(chars) {
  const tileMatrix = createEmptyTerrainMatrix();

  if (chars.length === 50) {
    const flatTiles = [];
    for (let index = 0; index < chars.length; index += 1) {
      let value = BASE64_ALPHABET.indexOf(chars[index]);
      if (value === -1) value = 0;
      flatTiles.push(value >> 3, value & 7);
    }

    let flatIndex = 0;
    for (let r = 0; r < GRID_SIZE; r += 1) {
      for (let c = 0; c < GRID_SIZE; c += 1) {
        tileMatrix[r][c] = LEGACY_INT_TILE_MAP[flatTiles[flatIndex]] || "GRASS";
        flatIndex += 1;
      }
    }

    return tileMatrix;
  }

  let charIndex = 0;
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      let value = BASE64_ALPHABET.indexOf(chars[charIndex]);
      if (value === -1) value = 0;
      tileMatrix[r][c] = LEGACY_INT_TILE_MAP[value] || "GRASS";
      charIndex += 1;
    }
  }

  return tileMatrix;
}

function decodeLegacyMapDefinition(encodedMap) {
  if (encodedMap.length === 100 && [...encodedMap].some((char) => !LEGACY_INT_TILE_MAP[BASE64_ALPHABET.indexOf(char)])) {
    throw new Error("Invalid map payload: unknown legacy terrain code");
  }
  return legacyTileMatrixToMapDefinition(decodeLegacyUrlSafeBase64ToTileMatrix(encodedMap));
}

let decodingDepth = 0;
export function decodeMapDefinition(encodedMap) {
  if (decodingDepth >= 4) throw new Error("Invalid map payload: nested source depth");
  decodingDepth++;
  try { return decodeMapPayload(encodedMap); }
  finally { decodingDepth--; }
}

function decodeMapPayload(encodedMap) {
  if (typeof encodedMap === "string" && encodedMap.startsWith(V5_MAP_DEFINITION_PREFIX)) return decodeModernMapDefinition(encodedMap, 5);
  if (typeof encodedMap === "string" && encodedMap.startsWith(V4_MAP_DEFINITION_PREFIX)) {
    return decodeModernMapDefinition(encodedMap, 4);
  }

  if (typeof encodedMap === "string" && encodedMap.startsWith(V3_MAP_DEFINITION_PREFIX)) {
    return decodeModernMapDefinition(encodedMap, 3);
  }

  if (typeof encodedMap === "string" && encodedMap.startsWith(V2_MAP_DEFINITION_PREFIX)) {
    return decodeV2MapDefinition(encodedMap);
  }

  if (isLegacyEncodedMap(encodedMap)) {
    return decodeLegacyMapDefinition(encodedMap);
  }

  throw new Error("Unsupported map payload");
}

export function normalizeEncodedMap(encodedMap) {
  return encodeMapDefinition(decodeMapDefinition(encodedMap));
}
