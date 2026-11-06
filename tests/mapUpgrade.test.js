import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyMapDefinition, createRampMapDefinition, cloneMapDefinition, setLegacyTileAt, getTilePlacementPlan } from "../src/domain/map/mapModel.js";
import { decodeMapDefinition, encodeMapDefinition, normalizeEncodedMap, isMapDefinitionEncodedMap } from "../src/domain/map/mapCodec.js";
import { beginMapUpgrade, createMapUpgradeDraft, getLegacyBridgeContacts } from "../src/domain/map/mapUpgrade.js";
import { encodeLegacyMapDefinition } from "./helpers/legacyPayload.js";
import { validateMapDefinition } from "../src/domain/rules/mapValidation.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";

const payload = (encoded) => JSON.parse(Buffer.from(encoded.slice(3), "base64url").toString());
const wrap = (data) => `v${data.v}.${Buffer.from(JSON.stringify(data)).toString("base64url")}`;

test("v4 round trips explicit ramp rules, all directions and existing features with stable terrain codes", () => {
  const map = createRampMapDefinition({ meta: { name: "四向上下桥" } });
  map.terrain[0].splice(0, 6, "OVERPASS", "MOUNTAIN", "OVERPASS_RAMP_N", "OVERPASS_RAMP_E", "OVERPASS_RAMP_S", "OVERPASS_RAMP_W");
  [[3, 3, "BANK"], [4, 4, "FARM"], [8, 1, "POLICE_SPAWN"], [9, 8, "THIEF_SPAWN"]].forEach(([r, c, type]) => setLegacyTileAt(map, r, c, type));
  map.features[1].config = { maxAnimals: 5 };
  const encoded = encodeMapDefinition(map);
  assert.ok(encoded.startsWith("v4."));
  assert.equal(isMapDefinitionEncodedMap(encoded), true);
  assert.equal(payload(encoded).t.slice(0, 6), "JKLMNO");
  assert.deepEqual(decodeMapDefinition(encoded), map);
  assert.equal(normalizeEncodedMap(encoded), encoded);
});

test("old formats cannot smuggle new ramps or override their ruleset", () => {
  const map = createEmptyMapDefinition();
  const data = payload(encodeMapDefinition(map));
  for (const v of [2, 3]) {
    assert.throws(() => decodeMapDefinition(wrap({ ...data, v, t: `L${data.t.slice(1)}` })), /Invalid map payload/);
    assert.throws(() => decodeMapDefinition(wrap({ ...data, v, b: "ramps" })), /require v4/);
  }
  assert.equal(getTilePlacementPlan(map, 0, 0, "OVERPASS_RAMP_N").canPlace, false);
  setLegacyTileAt(map, 0, 0, "OVERPASS_RAMP_N");
  assert.equal(map.terrain[0][0], "ROAD");
  map.terrain[0][0] = "OVERPASS_RAMP_N";
  assert.throws(() => encodeMapDefinition(map), /requires ramp rules/);
});

test("upgrade drafts preserve original geometry, source identity and pending/editing states through repeated reads", () => {
  const original = createEmptyMapDefinition();
  setLegacyTileAt(original, 4, 4, "OVERPASS");
  setLegacyTileAt(original, 5, 4, "BANK");
  const before = structuredClone(original);
  const encodedMap = encodeMapDefinition(original);
  const draft = createMapUpgradeDraft({ encodedMap, mapId: "original", name: "旧桥图" });
  assert.deepEqual(original, before);
  assert.deepEqual(draft.terrain, original.terrain);
  assert.deepEqual(draft.features, original.features);
  assert.equal(draft.upgrade.status, "pending");
  assert.deepEqual(draft.upgrade.source, { encodedMap, mapId: "original", name: "旧桥图" });
  const editing = beginMapUpgrade(draft);
  assert.equal(draft.upgrade.status, "pending");
  assert.equal(editing.upgrade.status, "editing");
  for (const state of [draft, editing]) {
    let restored = state;
    for (let index = 0; index < 3; index += 1) restored = cloneMapDefinition(decodeMapDefinition(normalizeEncodedMap(encodeMapDefinition(restored))));
    assert.deepEqual(restored, state);
  }
  assert.throws(() => createMapUpgradeDraft({ encodedMap: encodeMapDefinition(draft) }), /already uses ramp rules/);
});

test("v2 and legacy sources are retained exactly; maps without bridges need no bridge review", () => {
  const map = createEmptyMapDefinition();
  setLegacyTileAt(map, 0, 0, "POLICE_SPAWN");
  const v3 = payload(encodeMapDefinition(map));
  const sources = [wrap({ ...v3, v: 2 }), encodeLegacyMapDefinition(map)];
  for (const encodedMap of sources) {
    const draft = createMapUpgradeDraft({ encodedMap });
    assert.equal(draft.upgrade.status, "ready");
    assert.equal(decodeMapDefinition(encodeMapDefinition(draft)).upgrade.source.encodedMap, encodedMap);
    assert.deepEqual(draft.spawns, map.spawns);
  }
});

test("legacy bridge review includes water contacts and facilities without inserting or deleting cells", () => {
  const map = createEmptyMapDefinition();
  setLegacyTileAt(map, 0, 0, "OVERPASS");
  setLegacyTileAt(map, 0, 1, "BANK");
  setLegacyTileAt(map, 1, 0, "RIVER");
  const before = structuredClone(map);
  assert.deepEqual(getLegacyBridgeContacts(map), [
    { bridge: { r: 0, c: 0 }, ground: { r: 0, c: 1 }, direction: "E" },
    { bridge: { r: 0, c: 0 }, ground: { r: 1, c: 0 }, direction: "S" },
  ]);
  assert.deepEqual(map, before);
});

test("malformed v4 rules, upgrade states and nested or damaged sources fail closed", () => {
  const data = payload(encodeMapDefinition(createRampMapDefinition()));
  const old = encodeMapDefinition(createEmptyMapDefinition());
  for (const b of [undefined, "legacy", "future", null]) {
    assert.throws(() => decodeMapDefinition(wrap({ ...data, b })), /Invalid map payload/);
  }
  const validSource = { encodedMap: old, mapId: "old" };
  for (const u of [null, [], {}, { status: "done", source: validSource },
    { status: "pending", source: { encodedMap: old, mapId: 2 } },
    { status: "editing", source: { encodedMap: encodeMapDefinition(createRampMapDefinition()) } },
    { status: "ready", source: { encodedMap: "v3.invalid!" } }]) {
    assert.throws(() => decodeMapDefinition(wrap({ ...data, u })));
  }
  assert.throws(() => cloneMapDefinition({ ...createRampMapDefinition(), ruleset: "future" }), /Unsupported map ruleset/);
});

test("v4 rejects facilities and spawns on bridge surfaces", () => {
  const data = payload(encodeMapDefinition(createRampMapDefinition()));
  const t = `L${data.t.slice(1)}`;
  assert.throws(() => decodeMapDefinition(wrap({ ...data, t, p: [0] })), /cannot occupy a bridge/);
  assert.throws(() => decodeMapDefinition(wrap({ ...data, t, f: [[5, 0]] })), /cannot occupy a bridge/);
});

test("unreviewed upgrades and legacy bridge maps cannot start, while new and reviewed maps use ramp gameplay", () => {
  const old = createEmptyMapDefinition();
  setLegacyTileAt(old, 4, 4, "OVERPASS");
  const draft = createMapUpgradeDraft({ encodedMap: encodeMapDefinition(old) });
  assert.match(validateMapDefinition(draft).errors[0], /校验并完成升级/);
  assert.throws(() => createGameSession(draft), /校验并完成升级/);
  assert.throws(() => createGameSession(old), /创建升级副本/);
  assert.doesNotThrow(() => createGameSession(createRampMapDefinition()));
  const reviewed = createMapUpgradeDraft({ encodedMap: encodeMapDefinition(createEmptyMapDefinition()) });
  assert.equal(reviewed.upgrade.status, "ready");
  assert.doesNotThrow(() => createGameSession(reviewed));
  assert.doesNotThrow(() => createGameSession(createEmptyMapDefinition()));
});
