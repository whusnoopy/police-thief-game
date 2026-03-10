import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";
import { setLegacyTileAt } from "../src/domain/map/mapModel.js";

const env = createTestEnvironment();
env.installGlobals();

const { init } = await import("../src/app/bootstrap.js");
const { state } = await import("../src/app/state.js");
const { getMapList, getCurrentMapId, persistCurrentMap } = await import(
  "../src/storage/mapRepository.js"
);

test("bootstrap initialization and map-list flow stay wired through the controllers", () => {
  init();

  assert.equal(state.mode, "EDITOR");
  assert.equal(env.elements["editor-view"].classList.contains("hidden"), false);
  assert.equal(env.elements["game-view"].classList.contains("hidden"), true);
  assert.equal(env.elements["map-list-view"].classList.contains("hidden"), true);
  assert.equal(env.elements["editor-board"].children.length, 100);
  assert.equal(env.elements.palette.children.length > 0, true);
  assert.match(env.elements["mode-indicator"].textContent, /^编辑中：地图 /);

  const storedAfterInit = getMapList();
  assert.equal(storedAfterInit.length, 1);
  assert.equal(storedAfterInit[0].encodedMap.startsWith("v2."), true);
  assert.equal(env.window.location.search.startsWith("?m=v2."), true);

  setLegacyTileAt(state.mapDefinition, 0, 0, "POLICE_SPAWN");
  persistCurrentMap();
  const originalMapId = getCurrentMapId();

  env.elements["btn-map-list"].click();
  assert.equal(state.mode, "MAP_LIST");
  assert.equal(env.elements["map-list-view"].classList.contains("hidden"), false);
  assert.equal(env.elements["map-list-grid"].children.length, 1);

  env.setPromptResponses(["空白图"]);
  env.elements["btn-create-map"].click();

  const mapsAfterCreate = getMapList();
  assert.equal(state.mode, "EDITOR");
  assert.equal(mapsAfterCreate.length, 2);
  assert.equal(getCurrentMapId() === originalMapId, false);
  assert.deepStrictEqual(state.mapDefinition.spawns.police, []);

  env.elements["btn-map-list"].click();
  assert.equal(env.elements["map-list-grid"].children.length, 2);

  const originalMapCard = env.elements["map-list-grid"].children[1];
  const loadButton = originalMapCard.children[2].children[0];
  loadButton.click();

  assert.equal(state.mode, "EDITOR");
  assert.equal(getCurrentMapId(), originalMapId);
  assert.deepStrictEqual(state.mapDefinition.spawns.police, [{ r: 0, c: 0 }]);
  assert.equal(env.elements["editor-view"].classList.contains("hidden"), false);
  assert.equal(env.elements["map-list-view"].classList.contains("hidden"), true);
});
