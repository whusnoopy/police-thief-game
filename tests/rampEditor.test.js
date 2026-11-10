import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";
import { createRampScenario } from "./helpers/rampScenario.js";
import { setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { encodeMapDefinition } from "../src/domain/map/mapCodec.js";
import { createMapUpgradeDraft, completeMapUpgrade } from "../src/domain/map/mapUpgrade.js";
import { APP_VERSION_LABEL } from "../src/config/version.js";

const env = createTestEnvironment();
env.installGlobals();
const { init } = await import("../src/app/bootstrap.js");
const { state, setMapDefinition } = await import("../src/app/state.js");
const { renderEditorBoard, undoMap, redoMap, clearMap, createUpgradeCopy, finishMapUpgrade } = await import("../src/features/editorController.js");
const { loadInitialMapIntoState, persistCurrentMap, getMapList, getCurrentMapId, retryMapSave } = await import("../src/storage/mapRepository.js");
const { gameController } = await import("../src/features/gameController.js");
const originalSet = env.localStorage.setItem;
init();

beforeEach(() => {
  gameController.dispose();
  env.localStorage.setItem = originalSet;
  env.localStorage.clear();
  env.window.location.search = "";
  state.mode = "EDITOR";
  state.currentPaletteType = "ROAD";
  for (const id of ["rules-modal", "share-link-modal", "victory-modal"]) env.elements[id].classList.add("hidden");
  loadInitialMapIntoState();
  renderEditorBoard();
});

function select(type) {
  env.elements.palette.querySelectorAll(".palette-item").find((item) => item.dataset.type === type).click();
}
function paint({ r, c }, pointerType = "mouse") {
  env.document.getElementById(`editor-cell-${r}-${c}`).dispatchEvent({ type: "pointerdown", pointerId: 1, button: 0, pointerType });
  env.document.dispatchEvent({ type: "pointerup", pointerId: 1 });
}
function loadLegacyBridge() {
  const scenario = createRampScenario();
  scenario.put(scenario.positions.up, "ROAD");
  scenario.put(scenario.positions.down, "ROAD");
  scenario.map.ruleset = "legacy";
  setMapDefinition(scenario.map);
  persistCurrentMap({ forceNewMap: true, mapName: "旧高架图" });
  renderEditorBoard();
  return scenario;
}

test("new maps show the package version and all ramp directions; visible and keyboard rotation agree", () => {
  assert.equal(state.mapDefinition.ruleset, "ramps");
  assert.equal(env.elements["app-version"].textContent, APP_VERSION_LABEL);
  assert.equal(APP_VERSION_LABEL, "测试版 5.0.8");
  assert.equal(env.document.getElementById("btn-rotate-ramp"), null);
  select("OVERPASS_RAMP_N");
  assert.equal(state.currentPaletteType, "OVERPASS_RAMP_N");
  env.document.dispatchEvent({ type: "keydown", key: "r", target: env.elements["editor-board"], preventDefault() {} });
  assert.equal(state.currentPaletteType, "OVERPASS_RAMP_E");
  env.document.dispatchEvent({ type: "keydown", key: "r", target: { tagName: "INPUT" }, preventDefault() {} });
  assert.equal(state.currentPaletteType, "OVERPASS_RAMP_E");
  select("OVERPASS_RAMP_W");
  assert.equal(state.currentPaletteType, "OVERPASS_RAMP_W");
});

test("ramp preview distinguishes both connected ends; painting a rotation undoes and redoes as one edit", () => {
  const { map, positions } = createRampScenario();
  setMapDefinition(map);
  renderEditorBoard();
  select("OVERPASS_RAMP_E");
  const cell = env.document.getElementById(`editor-cell-${positions.up.r}-${positions.up.c}`);
  cell.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
  const edges = cell.querySelectorAll(".bridge-preview-edge");
  assert.equal(edges.length, 4);
  assert.equal(edges.filter((edge) => edge.classList.contains("connected")).length, 2);
  select("OVERPASS_RAMP_S");
  paint(positions.up, "pen");
  assert.equal(state.mapDefinition.terrain[positions.up.r][positions.up.c], "OVERPASS_RAMP_S");
  assert.match(env.elements["bridge-panel"].textContent, /高端需连接普通高架/);
  undoMap();
  assert.equal(state.mapDefinition.terrain[positions.up.r][positions.up.c], "OVERPASS_RAMP_E");
  redoMap();
  assert.equal(state.mapDefinition.terrain[positions.up.r][positions.up.c], "OVERPASS_RAMP_S");
});

test("touch ramp dragging saves unfinished drafts and undoes the whole stroke", () => {
  select("OVERPASS_RAMP_N");
  env.document.getElementById("editor-cell-3-1").dispatchEvent({ type: "pointerdown", button: 0, pointerId: 7, pointerType: "touch" });
  env.document.elementFromPoint = () => env.document.getElementById("editor-cell-3-3");
  env.elements["editor-board"].dispatchEvent({ type: "pointermove", pointerId: 7, pointerType: "touch", clientX: 1, clientY: 1 });
  env.document.dispatchEvent({ type: "pointerup", pointerId: 7 });
  assert.deepEqual(state.mapDefinition.terrain[3].slice(1, 4), Array(3).fill("OVERPASS_RAMP_N"));
  undoMap();
  assert.deepEqual(state.mapDefinition.terrain[3].slice(1, 4), Array(3).fill("ROAD"));
  redoMap();
  assert.deepEqual(state.mapDefinition.terrain[3].slice(1, 4), Array(3).fill("OVERPASS_RAMP_N"));
});

test("upgrade UI preserves the original, locates old entrances and starts only after route review", () => {
  const { positions } = loadLegacyBridge();
  const originalId = getCurrentMapId();
  const original = structuredClone(getMapList().find((map) => map.id === originalId));
  env.elements["btn-start-game"].click();
  assert.match(env.alerts.at(-1), /创建升级副本/);
  env.document.getElementById("btn-upgrade-map").click();
  assert.notEqual(getCurrentMapId(), originalId);
  assert.equal(state.mapDefinition.upgrade.status, "editing");
  assert.match(env.elements["bridge-panel"].textContent, /原图入口参考/);
  env.elements["bridge-panel"].querySelectorAll(".bridge-location")[0].click();
  assert.equal(env.elements["editor-board"].querySelectorAll(".bridge-inspection").length, 1);
  assert.equal(finishMapUpgrade(), false);
  select("OVERPASS_RAMP_E"); paint(positions.up);
  select("OVERPASS_RAMP_W"); paint(positions.down);
  env.document.getElementById("btn-finish-upgrade").click();
  assert.equal(state.mapDefinition.upgrade.status, "ready");
  assert.deepEqual(getMapList().find((map) => map.id === originalId), original);
  env.elements["btn-start-game"].click();
  assert.equal(state.mode, "GAME");
  assert.equal(gameController.session.mapDefinition.ruleset, "ramps");
});

test("editing a reviewed upgrade requires review again; undo and redo restore the matching review state", () => {
  const { map, positions } = createRampScenario();
  const old = structuredClone(map);
  old.ruleset = "legacy";
  setLegacyTileAt(old, positions.up.r, positions.up.c, "ROAD");
  setLegacyTileAt(old, positions.down.r, positions.down.c, "ROAD");
  const draft = createMapUpgradeDraft({ encodedMap: encodeMapDefinition(old) });
  setLegacyTileAt(draft, positions.up.r, positions.up.c, "OVERPASS_RAMP_E");
  setLegacyTileAt(draft, positions.down.r, positions.down.c, "OVERPASS_RAMP_W");
  setMapDefinition(completeMapUpgrade(draft).mapDefinition);
  renderEditorBoard();
  select("ROAD"); paint({ r: 0, c: 0 });
  assert.equal(state.mapDefinition.upgrade.status, "editing");
  undoMap();
  assert.equal(state.mapDefinition.upgrade.status, "ready");
  redoMap();
  assert.equal(state.mapDefinition.upgrade.status, "editing");
  clearMap();
  assert.equal(state.mapDefinition.upgrade.source.encodedMap, encodeMapDefinition(old));
  assert.equal(state.mapDefinition.upgrade.status, "editing");
});

test("upgrade copy creation survives a failed write and recovery without replacing the original", () => {
  loadLegacyBridge();
  const originalId = getCurrentMapId();
  const original = structuredClone(getMapList().find((map) => map.id === originalId));
  env.localStorage.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
  createUpgradeCopy();
  const upgradedId = getCurrentMapId();
  assert.notEqual(upgradedId, originalId);
  assert.equal(state.mapDefinition.upgrade.source.mapId, originalId);
  assert.equal(env.elements["storage-notice"].classList.contains("hidden"), false);
  env.localStorage.setItem = originalSet;
  retryMapSave();
  assert.equal(getCurrentMapId(), upgradedId);
  assert.deepEqual(getMapList().find((map) => map.id === originalId), original);
  assert.equal(getMapList().find((map) => map.id === upgradedId).schemaVersion, 4);
});

test("restarting gameplay with a changed ramp discards the previous reachable set", () => {
  const { map, positions, put } = createRampScenario();
  gameController.init(map);
  gameController.thiefUnits[0].inCar = true;
  gameController.diceValue = 2;
  const first = gameController.calculateReachableForUnit(gameController.thiefUnits[0]);
  assert.equal(first.has(`${positions.deck.r},${positions.deck.c}`), true);
  put(positions.up, "OVERPASS_RAMP_W");
  gameController.init(map);
  gameController.thiefUnits[0].inCar = true;
  gameController.diceValue = 2;
  assert.equal(gameController.calculateReachableForUnit(gameController.thiefUnits[0]).has(`${positions.deck.r},${positions.deck.c}`), false);
});
