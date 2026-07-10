import { GRID_SIZE } from "../../config/constants.js";
import {
  DEFAULT_TERRAIN_TILE_TYPE,
  FEATURE_TILE_TYPES,
  TERRAIN_TILE_TYPES,
  createEmptyMapDefinition,
  createEmptyTerrainMatrix,
  indexToPosition,
  legacyTileMatrixToMapDefinition,
  normalizeMapDefinition,
  positionToIndex,
} from "./mapModel.js";

const CURRENT_MAP_DEFINITION_PREFIX = "v3.";
const V2_MAP_DEFINITION_PREFIX = "v2.";
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// These codes are persistence contracts. Never derive them from array order or
// reuse a retired value; new tile types must receive a new explicit code.
const TERRAIN_CODE_BY_TYPE = Object.freeze({
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

function encodeTerrainMatrix(terrainMatrix) {
  let chars = "";
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      const terrainType = terrainMatrix[r][c];
      chars += BASE64_ALPHABET[TERRAIN_CODE_BY_TYPE[terrainType] ?? 0];
    }
  }
  return chars;
}

function decodeTerrainMatrix(chars, typeByCode = TERRAIN_TYPE_BY_CODE) {
  const terrainMatrix = createEmptyTerrainMatrix();
  let index = 0;
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
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
    (encodedMap.startsWith(CURRENT_MAP_DEFINITION_PREFIX) ||
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
  const payload = {
    v: 3,
    t: encodeTerrainMatrix(normalized.terrain),
    f: normalized.features.map((feature) => [
      FEATURE_CODE_BY_TYPE[feature.kind],
      positionToIndex(feature.position),
      feature.config || {},
      feature.id,
    ]),
    p: normalized.spawns.police.map(positionToIndex),
    h: normalized.spawns.thief.map(positionToIndex),
    m: normalized.meta.name ? { n: normalized.meta.name } : undefined,
  };
  return `${CURRENT_MAP_DEFINITION_PREFIX}${encodeJsonPayload(payload)}`;
}

function decodeV2MapDefinition(encodedMap) {
  const payload = decodeJsonPayload(encodedMap.slice(V2_MAP_DEFINITION_PREFIX.length));
  const mapDefinition = createEmptyMapDefinition();
  mapDefinition.terrain = decodeTerrainMatrix(payload.t || "", TERRAIN_TILE_TYPES);
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
    ? payload.p.map(indexToPosition)
    : [];
  mapDefinition.spawns.thief = Array.isArray(payload.h)
    ? payload.h.map(indexToPosition)
    : [];
  return normalizeMapDefinition(mapDefinition);
}

function decodeV3MapDefinition(encodedMap) {
  const payload = decodeJsonPayload(encodedMap.slice(CURRENT_MAP_DEFINITION_PREFIX.length));
  const mapDefinition = createEmptyMapDefinition({
    meta: {
      name: typeof payload.m?.n === "string" ? payload.m.n : "",
    },
  });
  mapDefinition.terrain = decodeTerrainMatrix(payload.t || "");
  mapDefinition.features = Array.isArray(payload.f)
    ? payload.f
        .map(([kindCode, positionIndex, config, id], index) => {
          const kind = FEATURE_TYPE_BY_CODE[kindCode];
          const position = indexToPosition(positionIndex);
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
    ? payload.p.map(indexToPosition)
    : [];
  mapDefinition.spawns.thief = Array.isArray(payload.h)
    ? payload.h.map(indexToPosition)
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
  return legacyTileMatrixToMapDefinition(decodeLegacyUrlSafeBase64ToTileMatrix(encodedMap));
}

export function decodeMapDefinition(encodedMap) {
  if (typeof encodedMap === "string" && encodedMap.startsWith(CURRENT_MAP_DEFINITION_PREFIX)) {
    return decodeV3MapDefinition(encodedMap);
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
