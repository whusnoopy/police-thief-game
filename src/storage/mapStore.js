import { encodeMapDefinition, normalizeEncodedMap } from "../domain/map/mapCodec.js";
import { legacyTileMatrixToMapDefinition } from "../domain/map/mapModel.js";
import { GRID_SIZE, TILE_TYPES } from "../config/constants.js";

export const STORAGE_KEYS = {
  mapList: "policeThief.maps.v3",
  v2MapList: "policeThief.maps.v2",
  currentMapId: "policeThief.currentMapId",
  legacyMapList: "policeThiefMapList",
  legacyCurrentMapId: "policeThiefCurrentMapId",
  legacySingleMap: "policeThiefMap",
};

export function generateMapId() {
  return `map_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function formatDefaultMapName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `地图 ${month}/${day} ${hours}:${minutes}`;
}

function tryNormalizeEncodedMap(encodedMap) {
  try {
    return normalizeEncodedMap(encodedMap);
  } catch (error) {
    return null;
  }
}

export function normalizeStoredEncodedMap(encodedMap) {
  return tryNormalizeEncodedMap(encodedMap) || encodedMap;
}

export function normalizeMapRecord(record = {}, options = {}) {
  const rawRecord = record;
  record = record && typeof record === "object" && !Array.isArray(record) ? record : {};
  const { idFactory = generateMapId } = options;
  const timestamp = record.updatedAt || record.date || Date.now();
  const source = record.encodedMap ?? record.data ?? "";
  const encodedMap = tryNormalizeEncodedMap(source);

  return {
    id: record.id || idFactory(),
    name: record.name || formatDefaultMapName(new Date(timestamp)),
    encodedMap: encodedMap || source,
    updatedAt: timestamp,
    schemaVersion: 3,
    ...(!encodedMap ? {
      isCorrupt: true,
      rawRecord: Object.hasOwn(record, "rawRecord") ? record.rawRecord : rawRecord,
    } : {}),
  };
}

function readMapList(storage, key, options) {
  const storedList = storage.getItem(key);
  if (!storedList) return [];

  try {
    const parsed = JSON.parse(storedList);
    if (!Array.isArray(parsed)) throw new Error("Map list must be an array");
    return parsed.map((record, index) => normalizeMapRecord(record, {
      idFactory: () => `recovered_${key}_${index}`,
      ...options,
    }));
  } catch (error) {
    throw Object.assign(new Error("地图库数据无法读取，原始数据已保留。"), { storageKey: key, cause: error });
  }
}

export function getMapListFromStorage(storage, options = {}) {
  return readMapList(storage, STORAGE_KEYS.mapList, options);
}

function getLegacyMapListFromStorage(storage, options = {}) {
  return readMapList(storage, STORAGE_KEYS.legacyMapList, options);
}

function getV2MapListFromStorage(storage, options = {}) {
  return readMapList(storage, STORAGE_KEYS.v2MapList, options);
}

export function setMapListToStorage(storage, list) {
  storage.setItem(STORAGE_KEYS.mapList, JSON.stringify(list));
}

export function getCurrentMapIdFromStorage(storage) {
  return storage.getItem(STORAGE_KEYS.currentMapId) || "";
}

export function setCurrentMapIdToStorage(storage, mapId) {
  if (!mapId) {
    storage.removeItem(STORAGE_KEYS.currentMapId);
    return;
  }

  storage.setItem(STORAGE_KEYS.currentMapId, mapId);
}

function normalizeLegacyJsonMap(legacyJsonMap) {
  try {
    const parsed = JSON.parse(legacyJsonMap);
    if (
      !Array.isArray(parsed) || parsed.length !== GRID_SIZE ||
      !parsed.every((row) => Array.isArray(row) && row.length === GRID_SIZE &&
        row.every((tile) => typeof tile === "string" && Object.hasOwn(TILE_TYPES, tile)))
    ) return null;
    return encodeMapDefinition(legacyTileMatrixToMapDefinition(parsed));
  } catch (error) {
    return null;
  }
}

function getLegacySingleEncodedMapFromStorage(storage) {
  const storedMap = storage.getItem(STORAGE_KEYS.legacySingleMap);
  if (!storedMap) return null;

  const result = storedMap.trim().startsWith("[")
    ? normalizeLegacyJsonMap(storedMap) : tryNormalizeEncodedMap(storedMap);
  if (!result) throw Object.assign(new Error("旧地图无法读取，原始数据已保留。"), { storageKey: STORAGE_KEYS.legacySingleMap });
  return result;
}

function clearLegacyStorage(storage) {
  storage.removeItem(STORAGE_KEYS.v2MapList);
  storage.removeItem(STORAGE_KEYS.legacyMapList);
  storage.removeItem(STORAGE_KEYS.legacyCurrentMapId);
  storage.removeItem(STORAGE_KEYS.legacySingleMap);
}

function moveCurrentMapToFront(maps, currentMapId) {
  if (!currentMapId) return maps;

  const currentMap = maps.find((mapItem) => mapItem.id === currentMapId);
  if (!currentMap) return maps;

  return [currentMap, ...maps.filter((mapItem) => mapItem.id !== currentMapId)];
}

export function migrateLegacyStorage(storage, options = {}) {
  const hasLegacyData =
    storage.getItem(STORAGE_KEYS.v2MapList) !== null ||
    storage.getItem(STORAGE_KEYS.legacyMapList) !== null ||
    storage.getItem(STORAGE_KEYS.legacyCurrentMapId) !== null ||
    storage.getItem(STORAGE_KEYS.legacySingleMap) !== null;

  if (!hasLegacyData) {
    return {
      migrated: false,
      mapList: getMapListFromStorage(storage, options),
      currentMapId: getCurrentMapIdFromStorage(storage),
    };
  }

  let nextMapList = getMapListFromStorage(storage, options);
  const v2MapList = getV2MapListFromStorage(storage, options);
  const legacyMapList = getLegacyMapListFromStorage(storage, options);
  const existingIds = new Set(nextMapList.map((mapItem) => mapItem.id));
  [...v2MapList, ...legacyMapList].forEach((mapItem) => {
    if (existingIds.has(mapItem.id)) return;
    nextMapList.push(mapItem);
    existingIds.add(mapItem.id);
  });

  let migratedSingleMapRecord = null;
  const legacySingleEncodedMap = getLegacySingleEncodedMapFromStorage(storage);
  if (
    legacySingleEncodedMap &&
    !nextMapList.some((mapItem) => mapItem.encodedMap === legacySingleEncodedMap)
  ) {
    migratedSingleMapRecord = normalizeMapRecord(
      {
        encodedMap: legacySingleEncodedMap,
      },
      options,
    );
    nextMapList.unshift(migratedSingleMapRecord);
  }

  let nextCurrentMapId = getCurrentMapIdFromStorage(storage);
  const legacyCurrentMapId = storage.getItem(STORAGE_KEYS.legacyCurrentMapId) || "";
  if (!nextCurrentMapId) {
    if (legacyCurrentMapId && nextMapList.some((mapItem) => mapItem.id === legacyCurrentMapId)) {
      nextCurrentMapId = legacyCurrentMapId;
    } else if (migratedSingleMapRecord) {
      nextCurrentMapId = migratedSingleMapRecord.id;
    } else {
      nextCurrentMapId = nextMapList[0]?.id || "";
    }
  }

  nextMapList = moveCurrentMapToFront(nextMapList, nextCurrentMapId);
  setMapListToStorage(storage, nextMapList);
  setCurrentMapIdToStorage(storage, nextCurrentMapId);
  clearLegacyStorage(storage);

  return {
    migrated: true,
    mapList: nextMapList,
    currentMapId: nextCurrentMapId,
  };
}

export function getStoredEncodedMapFromStorage(storage) {
  const mapList = getMapListFromStorage(storage);
  const currentMapId = getCurrentMapIdFromStorage(storage);
  const currentMap = mapList.find((mapItem) => mapItem.id === currentMapId) || mapList[0];
  return currentMap?.encodedMap || null;
}
