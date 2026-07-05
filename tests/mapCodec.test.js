import test from "node:test";
import assert from "node:assert/strict";
import { decodeMapDefinition, encodeMapDefinition, normalizeEncodedMap } from "../src/domain/map/mapCodec.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { encodeLegacyMapDefinition } from "./helpers/legacyPayload.js";

function toComparableMap(mapDefinition) {
  return {
    terrain: mapDefinition.terrain,
    features: mapDefinition.features
      .map((feature) => ({
        kind: feature.kind,
        position: feature.position,
      }))
      .sort((a, b) => `${a.kind}-${a.position.r}-${a.position.c}`.localeCompare(
        `${b.kind}-${b.position.r}-${b.position.c}`,
      )),
    spawns: mapDefinition.spawns,
  };
}

test("v2 codec preserves terrain, features, and spawns", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "ROAD");
  setLegacyTileAt(mapDefinition, 0, 1, "CROSSWALK_HORIZONTAL");
  setLegacyTileAt(mapDefinition, 0, 2, "CROSSWALK_VERTICAL");
  setLegacyTileAt(mapDefinition, 1, 1, "BUILDING");
  setLegacyTileAt(mapDefinition, 2, 2, "POLICE_STATION");
  setLegacyTileAt(mapDefinition, 3, 3, "MANHOLE");
  setLegacyTileAt(mapDefinition, 4, 4, "PARKING");
  setLegacyTileAt(mapDefinition, 5, 5, "BANK");
  setLegacyTileAt(mapDefinition, 8, 1, "POLICE_SPAWN");
  setLegacyTileAt(mapDefinition, 9, 8, "THIEF_SPAWN");

  const decoded = decodeMapDefinition(encodeMapDefinition(mapDefinition));

  assert.deepStrictEqual(toComparableMap(decoded), toComparableMap(mapDefinition));
});

test("legacy url payloads are upgraded into the v2 map definition model", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "ROAD");
  setLegacyTileAt(mapDefinition, 1, 1, "POLICE_STATION");
  setLegacyTileAt(mapDefinition, 2, 2, "MANHOLE");
  setLegacyTileAt(mapDefinition, 8, 1, "POLICE_SPAWN");
  setLegacyTileAt(mapDefinition, 9, 8, "THIEF_SPAWN");

  const legacyPayload = encodeLegacyMapDefinition(mapDefinition);
  const decoded = decodeMapDefinition(legacyPayload);

  assert.deepStrictEqual(toComparableMap(decoded), toComparableMap(mapDefinition));
  assert.equal(normalizeEncodedMap(legacyPayload).startsWith("v2."), true);
});

test("unsupported payloads still throw", () => {
  assert.throws(() => decodeMapDefinition("legacy-payload"), /Unsupported map payload/);
});
