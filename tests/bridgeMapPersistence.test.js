import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { createMapUpgradeDraft, beginMapUpgrade } from "../src/domain/map/mapUpgrade.js";
import { decodeMapDefinition, encodeMapDefinition } from "../src/domain/map/mapCodec.js";
import { normalizeMapRecord, getMapListFromStorage, setMapListToStorage, STORAGE_KEYS } from "../src/storage/mapStore.js";
import { upsertMapRecordInList } from "../src/storage/mapRecords.js";
import { planMapImport } from "../src/storage/mapBackup.js";
import { resolveInitialMapLoad } from "../src/storage/mapLoadPlan.js";

function originalRecord() {
  const map = createEmptyMapDefinition();
  setLegacyTileAt(map, 4, 4, "OVERPASS");
  return { id: "original", name: "旧桥图", encodedMap: encodeMapDefinition(map), updatedAt: 1, schemaVersion: 3 };
}

test("v4 saves create an upgrade copy, preserve the old record and subsequently update only the copy", () => {
  const original = originalRecord();
  const before = structuredClone(original);
  const draft = createMapUpgradeDraft({ encodedMap: original.encodedMap, mapId: original.id, name: original.name });
  const result = upsertMapRecordInList({ maps: [original], currentMapId: original.id, encodedMap: encodeMapDefinition(draft), createId: () => "upgrade", now: 2 });
  assert.equal(result.currentMapId, "upgrade");
  assert.equal(result.maps[0].schemaVersion, 4);
  assert.deepEqual(result.maps[1], before);
  assert.deepEqual(original, before);
  const collision = upsertMapRecordInList({ maps: [original], currentMapId: original.id, encodedMap: encodeMapDefinition(draft), createId: () => original.id });
  assert.equal(collision.currentMapId, "original_2");
  assert.deepEqual(collision.maps[1], before);
  const editing = encodeMapDefinition(beginMapUpgrade(draft));
  const next = upsertMapRecordInList({ maps: result.maps, currentMapId: "upgrade", encodedMap: editing, now: 3 });
  assert.equal(next.maps.length, 2);
  assert.equal(next.currentMapId, "upgrade");
  assert.equal(decodeMapDefinition(next.maps[0].encodedMap).upgrade.status, "editing");
  assert.deepEqual(next.maps[1], before);
});

test("pending and editing metadata survives storage reads, URL load and backup import with deduplication", () => {
  const original = originalRecord();
  const pending = createMapUpgradeDraft({ encodedMap: original.encodedMap, mapId: original.id });
  const editing = beginMapUpgrade(pending);
  const maps = [original, ...[pending, editing].map((draft, index) => normalizeMapRecord({
    id: `upgrade-${index}`, name: `升级${index}`, encodedMap: encodeMapDefinition(draft), updatedAt: 2,
  }))];
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  setMapListToStorage(storage, maps);
  const saved = storage.getItem(STORAGE_KEYS.mapList);
  const restored = getMapListFromStorage(storage);
  assert.equal(storage.getItem(STORAGE_KEYS.mapList), saved);
  assert.deepEqual(restored, maps);
  const imported = planMapImport(JSON.stringify({ version: 1, maps: restored }), [], { createId: () => "import", now: 4 });
  assert.equal(imported.imported, 3);
  assert.equal(planMapImport(JSON.stringify({ version: 1, maps: restored }), imported.maps).imported, 0);
  for (const [index, status] of ["pending", "editing"].entries()) {
    const encodedMap = restored[index + 1].encodedMap;
    const load = resolveInitialMapLoad({ savedEncodedMap: original.encodedMap, sharedEncodedMap: encodedMap });
    assert.equal(load.forceNewMap, true);
    assert.equal(load.mapDefinition.upgrade.status, status);
    assert.equal(load.mapDefinition.upgrade.source.encodedMap, original.encodedMap);
    assert.ok(imported.maps.some((record) => record.encodedMap === encodedMap));
  }
});

test("normalizing older source records retains their original encoding for an upgrade snapshot", () => {
  const old = originalRecord();
  const data = JSON.parse(Buffer.from(old.encodedMap.slice(3), "base64url").toString());
  const v2 = `v2.${Buffer.from(JSON.stringify({ ...data, v: 2 })).toString("base64url")}`;
  const normalized = normalizeMapRecord({ ...old, encodedMap: v2 });
  assert.ok(normalized.encodedMap.startsWith("v3."));
  assert.equal(normalized.originalEncodedMap, v2);
  assert.equal(normalizeMapRecord(normalized).originalEncodedMap, v2);
});

test("unknown or damaged new formats retain their original record on repeated backup import", () => {
  const broken = { id: "broken", name: "坏的新地图", encodedMap: "v4.invalid!", updatedAt: 1 };
  const record = normalizeMapRecord(broken);
  assert.equal(record.isCorrupt, true);
  assert.deepEqual(record.rawRecord, broken);
  const imported = planMapImport(JSON.stringify({ version: 1, maps: [record] }), []);
  assert.equal(imported.corrupt, 1);
  assert.deepEqual(imported.maps[0].rawRecord, broken);
});
