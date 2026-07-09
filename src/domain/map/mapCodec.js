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

const MAP_DEFINITION_PREFIX = "v2.";
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const TERRAIN_INT_MAP = TERRAIN_TILE_TYPES.reduce((acc, val, index) => {
  acc[val] = index;
  return acc;
}, {});
const FEATURE_INT_MAP = FEATURE_TILE_TYPES.reduce((acc, val, index) => {
  acc[val] = index;
  return acc;
}, {});
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
      chars += BASE64_ALPHABET[TERRAIN_INT_MAP[terrainType] ?? 0];
    }
  }
  return chars;
}

function decodeTerrainMatrix(chars) {
  const terrainMatrix = createEmptyTerrainMatrix();
  let index = 0;
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      if (index < chars.length) {
        const b6 = BASE64_ALPHABET.indexOf(chars[index]);
        terrainMatrix[r][c] = TERRAIN_TILE_TYPES[b6] || DEFAULT_TERRAIN_TILE_TYPE;
      }
      index += 1;
    }
  }
  return terrainMatrix;
}

export function isMapDefinitionEncodedMap(encodedMap) {
  return typeof encodedMap === "string" && encodedMap.startsWith(MAP_DEFINITION_PREFIX);
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
    v: 2,
    t: encodeTerrainMatrix(normalized.terrain),
    f: normalized.features.map((feature) => [
      FEATURE_INT_MAP[feature.kind],
      positionToIndex(feature.position),
    ]),
    p: normalized.spawns.police.map(positionToIndex),
    h: normalized.spawns.thief.map(positionToIndex),
  };
  return `${MAP_DEFINITION_PREFIX}${encodeJsonPayload(payload)}`;
}

function decodeV2MapDefinition(encodedMap) {
  const payload = decodeJsonPayload(encodedMap.slice(MAP_DEFINITION_PREFIX.length));
  const mapDefinition = createEmptyMapDefinition();
  mapDefinition.terrain = decodeTerrainMatrix(payload.t || "");
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
  if (isMapDefinitionEncodedMap(encodedMap)) {
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
