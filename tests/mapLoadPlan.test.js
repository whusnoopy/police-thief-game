import test from "node:test";
import assert from "node:assert/strict";
import { encodeMapDefinition } from "../src/domain/map/mapCodec.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { resolveInitialMapLoad } from "../src/storage/mapLoadPlan.js";
import { encodeLegacyMapDefinition } from "./helpers/legacyPayload.js";

function createEncodedMap(mutator) {
  const mapDefinition = createEmptyMapDefinition();
  mutator(mapDefinition);
  return encodeMapDefinition(mapDefinition);
}

test("shared map wins over storage and forces a new map when payloads differ", () => {
  const savedEncodedMap = createEncodedMap((map) => {
    setLegacyTileAt(map, 0, 0, "POLICE_SPAWN");
  });
  const sharedEncodedMap = createEncodedMap((map) => {
    setLegacyTileAt(map, 9, 9, "THIEF_SPAWN");
  });

  const result = resolveInitialMapLoad({ savedEncodedMap, sharedEncodedMap });

  assert.equal(result.source, "url");
  assert.equal(result.forceNewMap, true);
  assert.deepStrictEqual(result.mapDefinition.spawns.thief, [{ r: 9, c: 9 }]);
});

test("shared map does not force a new map when it matches storage", () => {
  const sharedEncodedMap = createEncodedMap((map) => {
    setLegacyTileAt(map, 0, 0, "POLICE_SPAWN");
  });
  const savedEncodedMap = sharedEncodedMap;

  const result = resolveInitialMapLoad({ savedEncodedMap, sharedEncodedMap });

  assert.equal(result.source, "url");
  assert.equal(result.forceNewMap, false);
  assert.deepStrictEqual(result.mapDefinition.spawns.police, [{ r: 0, c: 0 }]);
});

test("legacy shared payload is accepted and compared after normalization", () => {
  const sharedMap = createEmptyMapDefinition();
  setLegacyTileAt(sharedMap, 9, 9, "THIEF_SPAWN");

  const result = resolveInitialMapLoad({
    savedEncodedMap: encodeMapDefinition(createEmptyMapDefinition()),
    sharedEncodedMap: encodeLegacyMapDefinition(sharedMap),
  });

  assert.equal(result.source, "url");
  assert.equal(result.forceNewMap, true);
  assert.deepStrictEqual(result.mapDefinition.spawns.thief, [{ r: 9, c: 9 }]);
});

test("falls back to stored map when shared payload is invalid", () => {
  const savedEncodedMap = createEncodedMap((map) => {
    setLegacyTileAt(map, 4, 4, "PARKING");
  });

  const result = resolveInitialMapLoad({
    savedEncodedMap,
    sharedEncodedMap: "not-a-valid-map",
  });

  assert.equal(result.source, "storage");
  assert.equal(result.forceNewMap, false);
  assert.equal(result.mapDefinition.features[0].kind, "PARKING");
});

test("falls back to an empty map when neither storage nor url is usable", () => {
  const result = resolveInitialMapLoad({
    savedEncodedMap: "broken",
    sharedEncodedMap: "also-broken",
  });

  assert.equal(result.source, "empty");
  assert.equal(result.forceNewMap, false);
  assert.deepStrictEqual(result.mapDefinition.spawns.police, []);
  assert.deepStrictEqual(result.mapDefinition.spawns.thief, []);
});
