import test from "node:test";
import assert from "node:assert/strict";
import { decodeMapDefinition, encodeMapDefinition, normalizeEncodedMap } from "../src/domain/map/mapCodec.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { encodeLegacyMapDefinition } from "./helpers/legacyPayload.js";

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
});
