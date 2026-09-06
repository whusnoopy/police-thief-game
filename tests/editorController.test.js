import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";

const env = createTestEnvironment();
env.installGlobals();

const { setMapDefinition, state } = await import("../src/app/state.js");
const { createEmptyMapDefinition, setLegacyTileAt } = await import(
  "../src/domain/map/mapModel.js"
);
const { initEditor, renderEditorBoard, undoMap, redoMap, clearMap } = await import("../src/features/editorController.js");
const { getMapList, getCurrentMapId } = await import("../src/storage/mapRepository.js");
const { decodeMapDefinition } = await import("../src/domain/map/mapCodec.js");

function draw(r, c, options = {}) {
  env.document.getElementById(`editor-cell-${r}-${c}`).dispatchEvent({ type: "pointerdown", button: 0, pointerId: 1, pointerType: "mouse", ...options });
}
function endDraw() { env.document.dispatchEvent({ type: "pointerup", pointerId: 1 }); }
function resetMap(type = "GRASS") {
  state.mode = "EDITOR";
  state.currentPaletteType = type;
  setMapDefinition(createEmptyMapDefinition());
  renderEditorBoard();
}

test("editor previews valid and invalid tile placement before painting", () => {
  initEditor();
  const paletteGroups = env.elements.palette.querySelectorAll(".palette-group");
  assert.deepEqual(
    paletteGroups.map((group) => group.dataset.group),
    ["terrain", "building-facilities", "spawns", "special"],
  );
  assert.equal(paletteGroups[0].open, true);
  assert.equal(paletteGroups[1].open, false);

  paletteGroups[1].open = true;
  paletteGroups[1].dispatchEvent({ type: "toggle" });

  assert.equal(paletteGroups[0].open, false);
  assert.equal(paletteGroups[1].open, true);

  state.currentPaletteType = "MOUNTAIN";

  setMapDefinition(createEmptyMapDefinition());
  renderEditorBoard();

  const validCenter = env.document.getElementById("editor-cell-4-4");
  const validNeighbor = env.document.getElementById("editor-cell-4-5");
  validCenter.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });

  assert.equal(validCenter.classList.contains("placement-valid"), true);
  assert.equal(validNeighbor.classList.contains("placement-valid"), true);
  assert.equal(env.elements["editor-board"].querySelectorAll(".placement-ghost").length, 5);
  assert.equal(
    validCenter.querySelectorAll(".placement-ghost")[0].classList.contains("type-MOUNTAIN"),
    true,
  );
  assert.equal(
    validNeighbor.querySelectorAll(".placement-ghost")[0].classList.contains("type-GRASS"),
    true,
  );

  validCenter.dispatchEvent({ type: "pointerdown", button: 0, pointerId: 1 });
  env.document.dispatchEvent({ type: "pointerup", pointerId: 1 });

  assert.equal(state.mapDefinition.terrain[4][4], "MOUNTAIN");
  assert.equal(state.mapDefinition.terrain[4][5], "GRASS");

  const blockedMap = createEmptyMapDefinition();
  setLegacyTileAt(blockedMap, 4, 5, "BANK");
  setMapDefinition(blockedMap);
  renderEditorBoard();

  const invalidCenter = env.document.getElementById("editor-cell-4-4");
  invalidCenter.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });

  assert.equal(invalidCenter.classList.contains("placement-invalid"), true);
  assert.equal(
    invalidCenter.querySelectorAll(".placement-ghost")[0].classList.contains("type-MOUNTAIN"),
    true,
  );

  invalidCenter.dispatchEvent({ type: "pointerdown", button: 0, pointerId: 1 });
  env.document.dispatchEvent({ type: "pointerup", pointerId: 1 });

  assert.equal(state.mapDefinition.terrain[4][4], "ROAD");
  assert.equal(state.mapDefinition.features[0].kind, "BANK");

  state.currentPaletteType = "BANK";
  setMapDefinition(createEmptyMapDefinition());
  renderEditorBoard();

  const bankCell = env.document.getElementById("editor-cell-2-2");
  bankCell.dispatchEvent({ type: "pointerenter", pointerType: "mouse" });
  const bankGhost = bankCell.querySelectorAll(".placement-ghost")[0];

  assert.equal(bankCell.classList.contains("placement-valid"), true);
  assert.equal(env.elements["editor-board"].querySelectorAll(".placement-ghost").length, 1);
  assert.equal(bankGhost.classList.contains("type-BANK"), true);
  assert.equal(bankGhost.textContent, "🏦");
});

test("right click, middle click and secondary touch never paint", () => {
  resetMap();
  draw(0, 0, { button: 2 });
  draw(0, 0, { button: 1 });
  draw(0, 0, { pointerType: "touch", isPrimary: false });
  assert.equal(state.mapDefinition.terrain[0][0], "ROAD");
  assert.equal(env.elements["btn-undo-map"].disabled, true);
});

test("one touch stroke fills skipped cells and undoes as a single saved edit", () => {
  resetMap();
  draw(0, 0, { pointerType: "touch", isPrimary: true });
  env.document.elementFromPoint = () => env.document.getElementById("editor-cell-0-3");
  env.elements["editor-board"].dispatchEvent({ type: "pointermove", pointerId: 1, pointerType: "touch", clientX: 1, clientY: 1 });
  endDraw();
  assert.deepEqual(state.mapDefinition.terrain[0].slice(0, 4), Array(4).fill("GRASS"));
  undoMap();
  assert.deepEqual(state.mapDefinition.terrain[0].slice(0, 4), Array(4).fill("ROAD"));
  assert.equal(env.elements["btn-undo-map"].disabled, true);
  const saved = getMapList().find((map) => map.id === getCurrentMapId());
  assert.equal(decodeMapDefinition(saved.encodedMap).terrain[0][0], "ROAD");
  redoMap();
  assert.deepEqual(state.mapDefinition.terrain[0].slice(0, 4), Array(4).fill("GRASS"));
});

test("mountain footprint and clear map restore together, and new edits discard redo", () => {
  resetMap("MOUNTAIN");
  draw(4, 4); endDraw();
  undoMap();
  assert.equal(state.mapDefinition.terrain[4][4], "ROAD");
  assert.equal(state.mapDefinition.terrain[4][5], "ROAD");
  redoMap();
  assert.equal(state.mapDefinition.terrain[4][5], "GRASS");
  clearMap();
  assert.equal(state.mapDefinition.terrain[4][4], "ROAD");
  undoMap();
  assert.equal(state.mapDefinition.terrain[4][4], "MOUNTAIN");
  state.currentPaletteType = "BANK";
  draw(0, 0); endDraw();
  redoMap();
  assert.equal(state.mapDefinition.terrain[4][4], "MOUNTAIN");
  assert.equal(state.mapDefinition.features[0].kind, "BANK");
  assert.equal(env.elements["btn-redo-map"].disabled, true);
});

test("cancelled pen gesture commits once and history does not cross maps", () => {
  resetMap();
  draw(0, 0, { pointerType: "pen" });
  env.document.dispatchEvent({ type: "pointercancel", pointerId: 1 });
  undoMap();
  assert.equal(state.mapDefinition.terrain[0][0], "ROAD");
  redoMap();
  setMapDefinition(createEmptyMapDefinition({ meta: { name: "另一张地图" } }));
  renderEditorBoard();
  undoMap();
  assert.equal(state.mapDefinition.terrain[0][0], "ROAD");
  assert.equal(env.elements["btn-undo-map"].disabled, true);
});

test("keyboard undo preserves text input and redo works with command shift Z", () => {
  resetMap();
  ["rules-modal", "share-link-modal", "victory-modal"].forEach((id) => env.elements[id].classList.add("hidden"));
  draw(0, 0); endDraw();
  const key = { type: "keydown", key: "z", metaKey: true, preventDefault() {} };
  env.document.dispatchEvent({ ...key, target: env.elements["share-link-input"] });
  assert.equal(state.mapDefinition.terrain[0][0], "GRASS");
  env.document.dispatchEvent({ ...key, target: env.document.body });
  assert.equal(state.mapDefinition.terrain[0][0], "ROAD");
  env.document.dispatchEvent({ ...key, key: "Z", shiftKey: true, target: env.document.body });
  assert.equal(state.mapDefinition.terrain[0][0], "GRASS");
});
