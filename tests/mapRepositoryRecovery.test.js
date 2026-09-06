import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { encodeMapDefinition, decodeMapDefinition } from "../src/domain/map/mapCodec.js";
import { STORAGE_KEYS } from "../src/storage/mapStore.js";
import { encodeLegacyMapDefinition } from "./helpers/legacyPayload.js";

const env = createTestEnvironment();
env.installGlobals();
const { state } = await import("../src/app/state.js");
const { getMapList, setMapList, getCurrentMapId, persistCurrentMap, loadInitialMapIntoState, createMapBackup, retryMapSave, importMapBackup } =
  await import("../src/storage/mapRepository.js");
const { showMapList } = await import("../src/features/mapListController.js");
const realStorage = env.localStorage;
const originalSet = realStorage.setItem;
const originalGet = realStorage.getItem;
const validPayload = encodeMapDefinition(createEmptyMapDefinition());
const goodRecord = { id: "good", name: "Good", encodedMap: validPayload, schemaVersion: 3, updatedAt: 1 };
const brokenRecord = { id: "broken", name: "Broken", encodedMap: "v3.invalid!", schemaVersion: 3, updatedAt: 2 };

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { value: realStorage, writable: true, configurable: true });
  realStorage.setItem = originalSet;
  realStorage.getItem = originalGet;
  realStorage.clear();
  env.window.location.search = "";
  loadInitialMapIntoState();
  realStorage.clear();
  env.window.location.search = "";
});

test("removing the last damaged record clears its notice but keeps unrelated unreadable source notices", () => {
  realStorage.setItem(STORAGE_KEYS.mapList, JSON.stringify([goodRecord, brokenRecord]));
  getMapList();
  assert.equal(env.elements["storage-notice"].classList.contains("hidden"), false);
  setMapList([goodRecord]);
  assert.equal(env.elements["storage-notice"].classList.contains("hidden"), true);
  realStorage.setItem(STORAGE_KEYS.legacySingleMap, "bad legacy");
  loadInitialMapIntoState();
  setMapList([goodRecord]);
  assert.equal(env.elements["storage-notice"].classList.contains("hidden"), false);
});

test("backup import survives quota failure and retry without replacing current map", () => {
  realStorage.setItem(STORAGE_KEYS.mapList, JSON.stringify([goodRecord]));
  realStorage.setItem(STORAGE_KEYS.currentMapId, goodRecord.id);
  loadInitialMapIntoState();
  const editorMap = state.mapDefinition;
  const importedMap = createEmptyMapDefinition();
  setLegacyTileAt(importedMap, 4, 4, "BANK");
  realStorage.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
  const result = importMapBackup(JSON.stringify({ ...goodRecord, encodedMap: encodeMapDefinition(importedMap) }));
  assert.equal(result.imported, 1);
  assert.equal(result.saved, false);
  assert.equal(getCurrentMapId(), goodRecord.id);
  assert.equal(state.mapDefinition, editorMap);
  assert.equal(getMapList().length, 2);
  assert.equal(JSON.parse(realStorage.getItem(STORAGE_KEYS.mapList)).length, 1);
  realStorage.setItem = originalSet;
  retryMapSave();
  assert.equal(JSON.parse(realStorage.getItem(STORAGE_KEYS.mapList)).length, 2);
  assert.equal(env.elements["storage-notice"].classList.contains("hidden"), true);
});

test("reading a damaged record never rewrites the library and shows an explicit damaged card", () => {
  const raw = JSON.stringify([goodRecord, brokenRecord]);
  realStorage.setItem(STORAGE_KEYS.mapList, raw);
  const maps = getMapList();
  assert.equal(realStorage.getItem(STORAGE_KEYS.mapList), raw);
  assert.equal(maps[1].encodedMap, brokenRecord.encodedMap);
  assert.deepEqual(maps[1].rawRecord, brokenRecord);
  showMapList();
  assert.match(env.elements["map-list-grid"].textContent, /地图无法读取/);
  const buttons = env.elements["map-list-grid"].querySelectorAll("button");
  assert.ok(buttons.some((button) => button.textContent === "导出原始备份"));
  assert.equal(buttons.filter((button) => button.disabled).length, 3);
});

test("startup and subsequent edits preserve a corrupt current map as a separate record", () => {
  realStorage.setItem(STORAGE_KEYS.mapList, JSON.stringify([brokenRecord, goodRecord]));
  realStorage.setItem(STORAGE_KEYS.currentMapId, brokenRecord.id);
  loadInitialMapIntoState();
  setLegacyTileAt(state.mapDefinition, 0, 0, "BANK");
  persistCurrentMap();
  const maps = getMapList();
  assert.equal(maps.length, 3);
  assert.notEqual(getCurrentMapId(), brokenRecord.id);
  assert.equal(maps.find((record) => record.id === brokenRecord.id).encodedMap, brokenRecord.encodedMap);
  assert.deepEqual(maps.find((record) => record.id === brokenRecord.id).rawRecord, brokenRecord);
});

test("a valid shared link can open alongside a damaged saved map", () => {
  realStorage.setItem(STORAGE_KEYS.mapList, JSON.stringify([brokenRecord]));
  realStorage.setItem(STORAGE_KEYS.currentMapId, brokenRecord.id);
  env.window.location.search = `?m=${validPayload}`;
  assert.doesNotThrow(loadInitialMapIntoState);
  assert.equal(getMapList().length, 2);
  assert.equal(getMapList().find((record) => record.id === "broken").encodedMap, brokenRecord.encodedMap);
});

test("an unreadable entire library is retained through startup, edits, retries, and export", () => {
  const raw = '{"incomplete":';
  realStorage.setItem(STORAGE_KEYS.mapList, raw);
  realStorage.setItem(STORAGE_KEYS.currentMapId, "old");
  assert.doesNotThrow(loadInitialMapIntoState);
  setLegacyTileAt(state.mapDefinition, 1, 1, "BANK");
  persistCurrentMap();
  retryMapSave();
  assert.equal(realStorage.getItem(STORAGE_KEYS.mapList), raw);
  assert.equal(realStorage.getItem(STORAGE_KEYS.currentMapId), "old");
  const backup = createMapBackup();
  assert.equal(backup.unreadableStorage[STORAGE_KEYS.mapList], raw);
  assert.equal(backup.currentMap.mapDefinition.features[0].kind, "BANK");
  assert.equal(backup.maps[0].encodedMap, backup.currentMap.encodedMap);
  assert.equal(env.elements["storage-notice"].classList.contains("hidden"), false);
});

test("quota failures retain new maps and edits in memory, then a retry saves the latest map and id", () => {
  realStorage.setItem(STORAGE_KEYS.mapList, JSON.stringify([goodRecord]));
  realStorage.setItem(STORAGE_KEYS.currentMapId, goodRecord.id);
  realStorage.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
  assert.doesNotThrow(loadInitialMapIntoState);
  setLegacyTileAt(state.mapDefinition, 2, 2, "BANK");
  persistCurrentMap({ forceNewMap: true, mapName: "Unsaved" });
  const newId = getCurrentMapId();
  setLegacyTileAt(state.mapDefinition, 3, 3, "THIEF_BASE");
  persistCurrentMap();
  assert.equal(getMapList().length, 2);
  assert.equal(createMapBackup().maps[0].name, "Unsaved");
  assert.equal(JSON.parse(realStorage.getItem(STORAGE_KEYS.mapList)).length, 1);
  assert.equal(env.elements["storage-notice"].classList.contains("hidden"), false);
  realStorage.setItem = originalSet;
  retryMapSave();
  assert.equal(realStorage.getItem(STORAGE_KEYS.currentMapId), newId);
  const saved = JSON.parse(realStorage.getItem(STORAGE_KEYS.mapList));
  assert.equal(saved.length, 2);
  assert.equal(decodeMapDefinition(saved[0].encodedMap).features.length, 2);
  assert.equal(env.elements["storage-notice"].classList.contains("hidden"), true);
});

test("denied localStorage access does not crash and recovery merges previously unread maps", () => {
  realStorage.setItem(STORAGE_KEYS.mapList, JSON.stringify([goodRecord]));
  realStorage.setItem(STORAGE_KEYS.currentMapId, goodRecord.id);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() { throw new DOMException("denied", "SecurityError"); },
  });
  assert.doesNotThrow(loadInitialMapIntoState);
  setLegacyTileAt(state.mapDefinition, 5, 5, "BANK");
  assert.doesNotThrow(persistCurrentMap);
  assert.equal(createMapBackup().currentMap.mapDefinition.features[0].kind, "BANK");
  Object.defineProperty(globalThis, "localStorage", { value: realStorage, writable: true, configurable: true });
  retryMapSave();
  const maps = JSON.parse(realStorage.getItem(STORAGE_KEYS.mapList));
  assert.equal(maps.length, 2);
  assert.equal(maps.find((record) => record.id === "good").encodedMap, validPayload);
  assert.equal(env.elements["storage-notice"].classList.contains("hidden"), true);
});

test("a failed legacy migration keeps source keys and preserves map identity on retry", () => {
  const legacy = [{ id: "legacy", name: "Old", data: encodeLegacyMapDefinition(createEmptyMapDefinition()) }];
  const raw = JSON.stringify(legacy);
  realStorage.setItem(STORAGE_KEYS.legacyMapList, raw);
  realStorage.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
  assert.doesNotThrow(loadInitialMapIntoState);
  assert.equal(realStorage.getItem(STORAGE_KEYS.legacyMapList), raw);
  assert.equal(getMapList()[0].id, "legacy");
  realStorage.setItem = originalSet;
  retryMapSave();
  assert.equal(JSON.parse(realStorage.getItem(STORAGE_KEYS.mapList))[0].id, "legacy");
  assert.equal(realStorage.getItem(STORAGE_KEYS.legacyMapList), null);
});

test("malformed legacy source data is not removed while the current library remains usable", () => {
  realStorage.setItem(STORAGE_KEYS.mapList, JSON.stringify([goodRecord]));
  realStorage.setItem(STORAGE_KEYS.legacySingleMap, "broken legacy data");
  loadInitialMapIntoState();
  assert.equal(realStorage.getItem(STORAGE_KEYS.legacySingleMap), "broken legacy data");
  assert.equal(getMapList()[0].id, goodRecord.id);
  assert.equal(createMapBackup().unreadableStorage[STORAGE_KEYS.legacySingleMap], "broken legacy data");
});

test("null records do not hide other maps or lose their original data", () => {
  const raw = JSON.stringify([null, goodRecord]);
  realStorage.setItem(STORAGE_KEYS.mapList, raw);
  const maps = getMapList();
  assert.equal(maps.length, 2);
  assert.equal(maps[0].isCorrupt, true);
  assert.equal(maps[0].rawRecord, null);
  assert.equal(getMapList()[0].id, maps[0].id);
  assert.equal(realStorage.getItem(STORAGE_KEYS.mapList), raw);
});

test("an incomplete legacy JSON matrix is preserved rather than migrated to an empty map", () => {
  realStorage.setItem(STORAGE_KEYS.legacySingleMap, "[]");
  loadInitialMapIntoState();
  assert.equal(realStorage.getItem(STORAGE_KEYS.legacySingleMap), "[]");
  assert.equal(createMapBackup().unreadableStorage[STORAGE_KEYS.legacySingleMap], "[]");
});
