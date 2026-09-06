import test from "node:test";
import assert from "node:assert/strict";
import { planMapImport, MAX_BACKUP_BYTES } from "../src/storage/mapBackup.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { encodeMapDefinition } from "../src/domain/map/mapCodec.js";
import { normalizeMapRecord } from "../src/storage/mapStore.js";

function record(id, tile = "BANK", name = "我的地图") {
  const map = createEmptyMapDefinition();
  setLegacyTileAt(map, 1, 1, tile);
  return normalizeMapRecord({ id, name, encodedMap: encodeMapDefinition(map), updatedAt: 1 });
}

test("backup import preserves existing maps and resolves id and name collisions", () => {
  const existing = [record("same", "BANK")];
  const before = structuredClone(existing);
  const imported = record("same", "PARKING");
  const result = planMapImport(JSON.stringify({ version: 1, maps: [imported], currentMap: imported }), existing, { createId: () => "same", now: 10 });
  assert.equal(result.imported, 1);
  assert.equal(result.duplicates, 0);
  assert.equal(result.maps[0].id, "same_2");
  assert.equal(result.maps[0].name, "我的地图（导入）");
  assert.deepEqual(existing, before);
  assert.deepEqual(result.maps[1], before[0]);
});

test("current unsaved map is included and repeating the whole import adds nothing", () => {
  const maps = [record("first")];
  const currentMap = record("second", "PARKING");
  const text = JSON.stringify({ version: 1, maps, currentMap });
  const first = planMapImport(text, [], { createId: () => "new" });
  assert.equal(first.imported, 2);
  assert.equal(new Set(first.maps.map((item) => item.id)).size, 2);
  const second = planMapImport(text, first.maps);
  assert.equal(second.imported, 0);
  assert.equal(second.duplicates, 2);
  assert.deepEqual(second.maps, first.maps);
});

test("single map export can be restored and invalid files never produce partial imports", () => {
  assert.equal(planMapImport(JSON.stringify(record("single")), []).imported, 1);
  for (const text of ['{"version":1,"maps":[', '{"version":2,"maps":[]}', '{"version":1,"maps":{}}', '{}', 'null']) {
    assert.throws(() => planMapImport(text, []), /未导入任何地图/);
  }
  assert.throws(() => planMapImport(" ".repeat(MAX_BACKUP_BYTES + 1), []), /超过 5 MB/);
});

test("damaged records and unreadable library text survive an export/import cycle", () => {
  const broken = { id: "broken", encodedMap: "v3.invalid!", name: "损坏图" };
  const unreadableStorage = { "policeThief.maps.v3": '{"incomplete":' };
  const first = planMapImport(JSON.stringify({ version: 1, maps: [null, broken, record("good")], unreadableStorage }), []);
  assert.equal(first.imported, 1);
  assert.equal(first.corrupt, 3);
  assert.deepEqual(first.maps.find((map) => map.name === "损坏图").rawRecord, broken);
  assert.ok(first.maps.some((map) => map.isCorrupt && map.rawRecord === null));
  assert.deepEqual(first.maps.find((map) => map.name === "未解析的地图库原文").rawRecord, { unreadableStorage });
  const again = planMapImport(JSON.stringify({ version: 1, maps: first.maps }), []);
  assert.equal(again.corrupt, 3);
  assert.deepEqual(again.maps.map((map) => map.rawRecord), first.maps.map((map) => map.rawRecord));
});
