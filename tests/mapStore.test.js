import test from "node:test";
import assert from "node:assert/strict";
import { encodeMapDefinition } from "../src/domain/map/mapCodec.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import {
  getMapListFromStorage,
  getStoredEncodedMapFromStorage,
  migrateLegacyStorage,
  STORAGE_KEYS,
  setCurrentMapIdToStorage,
} from "../src/storage/mapStore.js";
import { encodeLegacyJsonMapDefinition, encodeLegacyMapDefinition } from "./helpers/legacyPayload.js";

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function createEncodedMap() {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "POLICE_SPAWN");
  setLegacyTileAt(mapDefinition, 2, 2, "PARKING");
  setLegacyTileAt(mapDefinition, 9, 9, "THIEF_SPAWN");
  return encodeMapDefinition(mapDefinition);
}

test("normalizes stored map records to schema v3 on read", () => {
  const encodedMap = createEncodedMap();
  const storage = createMemoryStorage({
    [STORAGE_KEYS.mapList]: JSON.stringify([
      {
        id: "map-1",
        name: "当前地图",
        encodedMap,
        date: 1700000000000,
      },
    ]),
  });

  const result = getMapListFromStorage(storage);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "map-1");
  assert.equal(result[0].encodedMap, encodedMap);
  assert.equal(result[0].schemaVersion, 3);
});

test("returns the current map payload from current storage", () => {
  const mapA = createEncodedMap();
  const mapB = encodeMapDefinition(createEmptyMapDefinition());
  const storage = createMemoryStorage({
    [STORAGE_KEYS.mapList]: JSON.stringify([
      {
        id: "map-a",
        name: "地图 A",
        encodedMap: mapA,
        updatedAt: 100,
        schemaVersion: 2,
      },
      {
        id: "map-b",
        name: "地图 B",
        encodedMap: mapB,
        updatedAt: 90,
        schemaVersion: 2,
      },
    ]),
    [STORAGE_KEYS.currentMapId]: "map-b",
  });

  assert.equal(getStoredEncodedMapFromStorage(storage), mapB);
});

test("clears the current map id when set to an empty value", () => {
  const storage = createMemoryStorage({
    [STORAGE_KEYS.currentMapId]: "map-a",
  });

  setCurrentMapIdToStorage(storage, "");

  assert.equal(storage.getItem(STORAGE_KEYS.currentMapId), null);
});

test("migrates legacy map-list storage into current keys and removes old keys", () => {
  const legacyMap = createEmptyMapDefinition();
  setLegacyTileAt(legacyMap, 1, 1, "POLICE_SPAWN");
  const storage = createMemoryStorage({
    [STORAGE_KEYS.legacyMapList]: JSON.stringify([
      {
        id: "legacy-map",
        name: "旧地图",
        data: encodeLegacyMapDefinition(legacyMap),
        date: 1700000000000,
      },
    ]),
    [STORAGE_KEYS.legacyCurrentMapId]: "legacy-map",
  });

  const result = migrateLegacyStorage(storage);
  const migratedList = getMapListFromStorage(storage);

  assert.equal(result.migrated, true);
  assert.equal(migratedList.length, 1);
  assert.equal(migratedList[0].id, "legacy-map");
  assert.equal(migratedList[0].encodedMap.startsWith("v3."), true);
  assert.equal(storage.getItem(STORAGE_KEYS.currentMapId), "legacy-map");
  assert.equal(storage.getItem(STORAGE_KEYS.legacyMapList), null);
  assert.equal(storage.getItem(STORAGE_KEYS.legacyCurrentMapId), null);
});

test("migrates a legacy single-map json payload and removes the old key", () => {
  const legacyMap = createEmptyMapDefinition();
  setLegacyTileAt(legacyMap, 4, 4, "PARKING");
  setLegacyTileAt(legacyMap, 9, 9, "THIEF_SPAWN");
  const storage = createMemoryStorage({
    [STORAGE_KEYS.legacySingleMap]: encodeLegacyJsonMapDefinition(legacyMap),
  });

  const result = migrateLegacyStorage(storage);
  const migratedList = getMapListFromStorage(storage);

  assert.equal(result.migrated, true);
  assert.equal(migratedList.length, 1);
  assert.equal(migratedList[0].encodedMap.startsWith("v3."), true);
  assert.equal(storage.getItem(STORAGE_KEYS.currentMapId), migratedList[0].id);
  assert.equal(storage.getItem(STORAGE_KEYS.legacySingleMap), null);
});

test("migrates v2 local map-list storage to v3 without changing map ids", () => {
  const v2Payload = "v2.eyJ2IjoyLCJ0IjoiRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRSIsImYiOltbMiwyMl0sWzUsNTVdXSwicCI6WzBdLCJoIjpbOTldfQ";
  const storage = createMemoryStorage({
    [STORAGE_KEYS.v2MapList]: JSON.stringify([
      {
        id: "v2-map",
        name: "以前保存的地图",
        encodedMap: v2Payload,
        updatedAt: 100,
        schemaVersion: 2,
      },
    ]),
    [STORAGE_KEYS.currentMapId]: "v2-map",
  });

  const result = migrateLegacyStorage(storage);
  const migratedList = getMapListFromStorage(storage);

  assert.equal(result.migrated, true);
  assert.equal(migratedList[0].id, "v2-map");
  assert.equal(migratedList[0].encodedMap.startsWith("v3."), true);
  assert.equal(migratedList[0].schemaVersion, 3);
  assert.equal(storage.getItem(STORAGE_KEYS.v2MapList), null);
  assert.ok(storage.getItem(STORAGE_KEYS.mapList));
});
