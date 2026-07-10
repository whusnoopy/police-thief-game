import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { encodeLegacyJsonMapDefinition, encodeLegacyMapDefinition } from "./helpers/legacyPayload.js";

const sharedLegacyMap = createEmptyMapDefinition();
setLegacyTileAt(sharedLegacyMap, 9, 9, "THIEF_SPAWN");

const storedLegacyMap = createEmptyMapDefinition();
setLegacyTileAt(storedLegacyMap, 0, 0, "POLICE_SPAWN");

const env = createTestEnvironment({
  search: `?m=${encodeLegacyMapDefinition(sharedLegacyMap)}`,
});
env.installGlobals();
env.localStorage.setItem(
  "policeThiefMap",
  encodeLegacyJsonMapDefinition(storedLegacyMap),
);

const { init } = await import("../src/app/bootstrap.js");
const { state } = await import("../src/app/state.js");

test("bootstrap migrates legacy localStorage, upgrades a legacy shared link, and removes old keys", () => {
  init();

  const rawMapList = env.localStorage.getItem("policeThief.maps.v3");
  assert.ok(rawMapList);

  const parsedMapList = JSON.parse(rawMapList);
  assert.equal(parsedMapList.length, 2);
  assert.equal(parsedMapList.every((mapItem) => mapItem.encodedMap.startsWith("v3.")), true);
  assert.deepStrictEqual(state.mapDefinition.spawns.thief, [{ r: 9, c: 9 }]);
  assert.equal(env.window.location.search.startsWith("?m=v3."), true);
  assert.equal(env.localStorage.getItem("policeThiefMap"), null);
  assert.ok(env.localStorage.getItem("policeThief.currentMapId"));
});
