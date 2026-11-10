import test from "node:test";
import assert from "node:assert/strict";
import { encodeMapDefinition } from "../src/domain/map/mapCodec.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { resolveInitialMapLoad } from "../src/storage/mapLoadPlan.js";
import { encodeLegacyMapDefinition } from "./helpers/legacyPayload.js";
import { EXAMPLE_MAP_NAME, createExampleMap } from "../src/domain/map/exampleMap.js";

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

test("a named example loads as a separate map, while a matching saved example can be reopened",()=>{
  const savedEncodedMap=createEncodedMap(map=>setLegacyTileAt(map,0,0,"BANK"));
  const result=resolveInitialMapLoad({savedEncodedMap,exampleId:"river-city"});
  assert.equal(result.source,"example");assert.equal(result.forceNewMap,true);
  assert.equal(result.mapDefinition.meta.name,EXAMPLE_MAP_NAME);assert.equal(result.mapDefinition.spawns.thief.length,2);
  assert.equal(resolveInitialMapLoad({savedEncodedMap:encodeMapDefinition(createExampleMap()),exampleId:"river-city"}).forceNewMap,false);
  const many = resolveInitialMapLoad({ savedEncodedMap, exampleId: "river-city-many" });
  assert.equal(many.source, "example");
  assert.equal(many.forceNewMap, true);
  assert.equal(many.mapDefinition.spawns.thief.length, 8);
  const duel = resolveInitialMapLoad({ exampleId: "river-city-duel" });
  assert.equal(duel.source, "example");
  assert.equal(duel.mapDefinition.actionRules, "continuous");
  assert.equal(duel.mapDefinition.spawns.thief.length, 2);
});

test("explicit shared maps take precedence over examples and unknown example names preserve the saved map",()=>{
  const sharedEncodedMap=createEncodedMap(map=>setLegacyTileAt(map,4,4,"BANK"));
  assert.equal(resolveInitialMapLoad({sharedEncodedMap,exampleId:"river-city"}).source,"url");
  assert.equal(resolveInitialMapLoad({savedEncodedMap:sharedEncodedMap,exampleId:"unknown"}).source,"storage");
});
