import test from "node:test";
import assert from "node:assert/strict";
import { upsertMapRecordInList } from "../src/storage/mapRecords.js";

test("creates a new current map record when the list is empty", () => {
  const result = upsertMapRecordInList({
    maps: [],
    currentMapId: "",
    encodedMap: "v2.map-a",
    now: new Date("2026-03-10T10:30:00+08:00").getTime(),
    createId: () => "map-new",
  });

  assert.equal(result.currentMapId, "map-new");
  assert.equal(result.maps.length, 1);
  assert.equal(result.maps[0].id, "map-new");
  assert.equal(result.maps[0].encodedMap, "v2.map-a");
  assert.equal(result.maps[0].schemaVersion, 3);
});

test("updates the current map record in place and moves it to the front", () => {
  const result = upsertMapRecordInList({
    maps: [
      {
        id: "map-1",
        name: "旧地图",
        encodedMap: "v2.old",
        updatedAt: 100,
        schemaVersion: 2,
      },
      {
        id: "map-2",
        name: "其他地图",
        encodedMap: "v2.other",
        updatedAt: 90,
        schemaVersion: 2,
      },
    ],
    currentMapId: "map-2",
    encodedMap: "v2.updated",
    now: 200,
  });

  assert.equal(result.currentMapId, "map-2");
  assert.equal(result.maps.length, 2);
  assert.equal(result.maps[0].id, "map-2");
  assert.equal(result.maps[0].encodedMap, "v2.updated");
  assert.equal(result.maps[0].updatedAt, 200);
  assert.equal(result.maps[1].id, "map-1");
});

test("forceNew creates a new record even when a current map exists", () => {
  const result = upsertMapRecordInList({
    maps: [
      {
        id: "map-1",
        name: "原地图",
        encodedMap: "v2.original",
        updatedAt: 100,
        schemaVersion: 2,
      },
    ],
    currentMapId: "map-1",
    encodedMap: "v2.duplicate",
    forceNew: true,
    name: "复制地图",
    now: 300,
    createId: () => "map-2",
  });

  assert.equal(result.currentMapId, "map-2");
  assert.equal(result.maps.length, 2);
  assert.equal(result.maps[0].id, "map-2");
  assert.equal(result.maps[0].name, "复制地图");
  assert.equal(result.maps[1].id, "map-1");
});
