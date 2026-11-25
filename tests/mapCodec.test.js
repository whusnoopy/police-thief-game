import test from "node:test";
import assert from "node:assert/strict";
import { decodeMapDefinition, encodeMapDefinition, encodeShareableMap, getMapContentSignature, normalizeEncodedMap } from "../src/domain/map/mapCodec.js";
import { createEmptyMapDefinition, createNewMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { DIRECTIONAL_SIGNAL_RULES } from "../src/domain/map/mapCompatibility.js";
import { createMapUpgradeDraft, completeMapUpgrade } from "../src/domain/map/mapUpgrade.js";
import { createMapExpansionDraft, completeMapExpansion } from "../src/domain/map/mapExpansion.js";
import { createActionUpgradeCopy } from "../src/domain/map/mapActionUpgrade.js";
import { encodeLegacyMapDefinition } from "./helpers/legacyPayload.js";
import { planMapImport } from "../src/storage/mapBackup.js";

function toComparableMap(mapDefinition) {
  return {
    meta: mapDefinition.meta,
    terrain: mapDefinition.terrain,
    features: mapDefinition.features
      .map((feature) => ({
        kind: feature.kind,
        id: feature.id,
        position: feature.position,
        config: feature.config,
      }))
      .sort((a, b) => `${a.kind}-${a.position.r}-${a.position.c}`.localeCompare(
        `${b.kind}-${b.position.r}-${b.position.c}`,
      )),
    spawns: mapDefinition.spawns,
  };
}

test("v3 codec preserves terrain, feature config, metadata, and spawns", () => {
  const mapDefinition = createEmptyMapDefinition({ meta: { name: "周末地图" } });
  setLegacyTileAt(mapDefinition, 0, 0, "ROAD");
  setLegacyTileAt(mapDefinition, 0, 1, "CROSSWALK_HORIZONTAL");
  setLegacyTileAt(mapDefinition, 0, 2, "CROSSWALK_VERTICAL");
  setLegacyTileAt(mapDefinition, 0, 3, "RIVER");
  setLegacyTileAt(mapDefinition, 0, 4, "OVERPASS");
  setLegacyTileAt(mapDefinition, 1, 1, "BUILDING");
  setLegacyTileAt(mapDefinition, 2, 2, "POLICE_STATION");
  setLegacyTileAt(mapDefinition, 3, 3, "MANHOLE");
  setLegacyTileAt(mapDefinition, 4, 4, "PARKING");
  setLegacyTileAt(mapDefinition, 5, 5, "BANK");
  setLegacyTileAt(mapDefinition, 6, 6, "FARM");
  mapDefinition.features.find((feature) => feature.kind === "FARM").config = {
    maxAnimals: 5,
  };
  mapDefinition.features.find((feature) => feature.kind === "FARM").id = "main-farm";
  setLegacyTileAt(mapDefinition, 7, 7, "MOUNTAIN");
  setLegacyTileAt(mapDefinition, 7, 8, "MOUNTAIN");
  assert.equal(mapDefinition.terrain[7][7], 'MOUNTAIN');
  assert.equal(mapDefinition.terrain[7][8], 'MOUNTAIN');
  setLegacyTileAt(mapDefinition, 8, 1, "POLICE_SPAWN");
  setLegacyTileAt(mapDefinition, 9, 8, "THIEF_SPAWN");

  const decoded = decodeMapDefinition(encodeMapDefinition(mapDefinition));

  assert.deepStrictEqual(toComparableMap(decoded), toComparableMap(mapDefinition));
  assert.equal(encodeMapDefinition(mapDefinition).startsWith("v3."), true);
});

test("legacy url payloads are upgraded into the current map definition model", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "ROAD");
  setLegacyTileAt(mapDefinition, 1, 1, "POLICE_STATION");
  setLegacyTileAt(mapDefinition, 2, 2, "MANHOLE");
  setLegacyTileAt(mapDefinition, 8, 1, "POLICE_SPAWN");
  setLegacyTileAt(mapDefinition, 9, 8, "THIEF_SPAWN");

  const legacyPayload = encodeLegacyMapDefinition(mapDefinition);
  const decoded = decodeMapDefinition(legacyPayload);

  assert.deepStrictEqual(toComparableMap(decoded), toComparableMap(mapDefinition));
  assert.equal(normalizeEncodedMap(legacyPayload).startsWith("v3."), true);
});

test("previous v2 share links remain readable and normalize to v3", () => {
  const v2Payload = "v2.eyJ2IjoyLCJ0IjoiRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRSIsImYiOltbMiwyMl0sWzUsNTVdXSwicCI6WzBdLCJoIjpbOTldfQ";
  const decoded = decodeMapDefinition(v2Payload);

  assert.deepStrictEqual(decoded.spawns.police, [{ r: 0, c: 0 }]);
  assert.deepStrictEqual(decoded.spawns.thief, [{ r: 9, c: 9 }]);
  assert.deepStrictEqual(
    decoded.features.map((feature) => [feature.kind, feature.position]),
    [
      ["PARKING", { r: 2, c: 2 }],
      ["BANK", { r: 5, c: 5 }],
    ],
  );
  assert.equal(normalizeEncodedMap(v2Payload).startsWith("v3."), true);
});

test("unsupported payloads still throw", () => {
  assert.throws(() => decodeMapDefinition("legacy-payload"), /Unsupported map payload/);
  assert.throws(() => decodeMapDefinition("_".repeat(100)), /unknown legacy terrain code/);
});

test("v5 saves and restores opt-in directional signals and rejects invalid combinations", () => {
  const map = createNewMapDefinition();
  const original = encodeMapDefinition(map);
  assert.equal(decodeMapDefinition(original).signalRules, undefined);
  map.signalRules = DIRECTIONAL_SIGNAL_RULES;
  const share = encodeMapDefinition(map);
  assert.deepEqual(decodeMapDefinition(share), map);
  assert.equal(normalizeEncodedMap(share), share);
  const result = planMapImport(JSON.stringify({ version: 1, maps: [{ encodedMap: share }] }), []);
  assert.equal(result.imported, 1);
  assert.equal(result.maps[0].encodedMap, share);
  const payload = JSON.parse(Buffer.from(share.slice(3), "base64url").toString());
  for (const l of [null, "unknown"]) {
    assert.throws(() => decodeMapDefinition(`v5.${Buffer.from(JSON.stringify({ ...payload, l })).toString("base64url")}`), /signal rules/);
  }
  assert.throws(() => encodeMapDefinition(createEmptyMapDefinition({ signalRules: DIRECTIONAL_SIGNAL_RULES })), /20×20/);
});

test("incomplete and unknown versioned data is rejected instead of becoming an empty map", () => {
  const encodePayload = (payload) => `v3.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  assert.throws(() => decodeMapDefinition(encodePayload({})), /Invalid map payload/);
  assert.throws(() => decodeMapDefinition(encodePayload({ v: 3, t: "E", f: [], p: [], h: [] })), /Invalid map payload/);
  const payload = { v: 3, t: "E".repeat(100), f: [[99, 5]], p: [], h: [] };
  assert.throws(() => decodeMapDefinition(encodePayload(payload)), /Invalid map payload/);
  assert.throws(() => decodeMapDefinition(encodePayload({ ...payload, f: [], p: [0], h: [0] })), /overlapping/);
});

test("compact feature encoding omits default config and id while preserving custom metadata", () => {
  const map = createNewMapDefinition();
  setLegacyTileAt(map, 5, 5, "BANK");
  setLegacyTileAt(map, 6, 6, "FARM");
  map.features.find((f) => f.kind === "FARM").config = { maxAnimals: 4 };
  const encoded = encodeMapDefinition(map);
  const payload = JSON.parse(Buffer.from(encoded.slice(3), "base64url").toString());
  assert.equal(payload.f[0].length, 2, "default feature encodes only [kindCode, index]");
  assert.deepEqual(payload.f[1], [6, 126, { maxAnimals: 4 }]);
  assert.deepEqual(decodeMapDefinition(encoded), map);
});

test("shareable map encoding syncs display name, strips completed provenance, and preserves unfinished drafts", () => {
  const legacy = createEmptyMapDefinition();
  for (const [r, c, tile] of [[0, 0, "POLICE_SPAWN"], [9, 9, "THIEF_SPAWN"], [9, 8, "BANK"], [8, 9, "THIEF_BASE"]]) {
    setLegacyTileAt(legacy, r, c, tile);
  }
  const upgraded = completeMapUpgrade(createMapUpgradeDraft({ encodedMap: encodeMapDefinition(legacy) })).mapDefinition;
  const expanded = completeMapExpansion(createMapExpansionDraft({ encodedMap: encodeMapDefinition(upgraded) })).mapDefinition;
  const chained = createActionUpgradeCopy({ encodedMap: encodeMapDefinition(expanded) });
  const rawEncoded = encodeMapDefinition(chained);
  const shared = encodeShareableMap(rawEncoded, { name: "重命名后的城市" });
  assert.ok(shared.length < rawEncoded.length / 2, "stripping completed provenance significantly shrinks chained share links");
  const decoded = decodeMapDefinition(shared);
  assert.equal(decoded.meta.name, "重命名后的城市");
  assert.equal(decoded.upgrade, undefined);
  assert.equal(decoded.expansion, undefined);
  assert.equal(decoded.actionUpgrade, undefined);
  assert.equal(decoded.ruleset, "ramps");
  assert.equal(decoded.actionRules, "continuous");
  assert.equal(getMapContentSignature(rawEncoded), getMapContentSignature(shared));

  // Unfinished drafts keep their review gate when shared.
  const draft = createMapExpansionDraft({ encodedMap: encodeMapDefinition(upgraded) });
  const sharedDraft = decodeMapDefinition(encodeShareableMap(draft, { name: "草稿" }));
  assert.equal(sharedDraft.meta.name, "草稿");
  assert.equal(sharedDraft.expansion?.status, "editing");
  assert.equal(sharedDraft.upgrade, undefined);
});
