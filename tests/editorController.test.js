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

test('continuous terrain refreshes after painting, undo and redo without replacing hit targets', () => {
  resetMap();
  const board = env.elements['editor-board'];
  const before = board.style.backgroundImage;
  const neighbor = env.document.getElementById('editor-cell-0-1');
  draw(0, 0); endDraw();
  const after = board.style.backgroundImage;
  assert.notEqual(after, before);
  assert.equal(env.document.getElementById('editor-cell-0-1'), neighbor);
  assert.match(decodeURIComponent(after), /data-tile="0,1" data-mask="6"/);
  undoMap();
  assert.equal(board.style.backgroundImage, before);
  redoMap();
  assert.equal(board.style.backgroundImage, after);
});

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
  assert.equal(bankGhost.querySelectorAll('.tile-art').length, 1);
  assert.match(bankGhost.querySelectorAll('.tile-art')[0].src, /bank\.webp/);
});

test('hover preview survives compatibility mouse events while crossing cells', () => {
  resetMap('BANK');
  const board = env.elements['editor-board'];
  const before = JSON.stringify(state.mapDefinition);
  let previous = null;
  for (const c of [2, 3, 4, 3]) {
    const cell = env.document.getElementById(`editor-cell-3-${c}`);
    previous?.dispatchEvent({ type: 'pointerleave', pointerType: 'mouse' });
    cell.dispatchEvent({ type: 'pointerenter', pointerType: 'mouse' });
    // Browsers can deliver compatibility mouseleave after the new pointerenter.
    previous?.dispatchEvent({ type: 'mouseleave' });
    assert.equal(cell.classList.contains('placement-center'), true);
    assert.equal(board.querySelectorAll('.placement-ghost').length, 1);
    previous = cell;
  }
  board.dispatchEvent({ type: 'pointerleave', pointerType: 'mouse' });
  assert.equal(board.querySelectorAll('.placement-ghost').length, 0);
  previous.dispatchEvent({ type: 'pointerenter', pointerType: 'touch' });
  assert.equal(board.querySelectorAll('.placement-ghost').length, 0);
  assert.equal(JSON.stringify(state.mapDefinition), before);
});

test('pen hover moves the full mountain footprint and clears it on exit', () => {
  resetMap('MOUNTAIN');
  const board = env.elements['editor-board'];
  const first = env.document.getElementById('editor-cell-4-4');
  const next = env.document.getElementById('editor-cell-4-5');
  first.dispatchEvent({ type: 'pointerenter', pointerType: 'pen' });
  assert.equal(board.querySelectorAll('.placement-ghost').length, 5);
  first.dispatchEvent({ type: 'pointerleave', pointerType: 'pen' });
  next.dispatchEvent({ type: 'pointerenter', pointerType: 'pen' });
  first.dispatchEvent({ type: 'mouseleave' });
  assert.equal(next.classList.contains('placement-center'), true);
  assert.equal(board.querySelectorAll('.placement-ghost').length, 5);
  assert.equal(env.document.getElementById('editor-cell-4-3').classList.contains('placement-preview'), false);
  next.dispatchEvent({ type: 'pointerleave', pointerType: 'pen' });
  assert.equal(board.querySelectorAll('.placement-ghost').length, 0);
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

test('dragging a mountain range preserves peaks and undoes the whole range and buffer', () => {
  resetMap('MOUNTAIN');
  const before = JSON.stringify(state.mapDefinition);
  draw(4, 3, { pointerType: 'touch', isPrimary: true });
  env.document.elementFromPoint = () => env.document.getElementById('editor-cell-4-6');
  env.elements['editor-board'].dispatchEvent({ type: 'pointermove', pointerId: 1, pointerType: 'touch', clientX: 1, clientY: 1 });
  endDraw();
  assert.deepEqual(state.mapDefinition.terrain[4].slice(3, 7), Array(4).fill('MOUNTAIN'));
  assert.deepEqual(state.mapDefinition.terrain[3].slice(3, 7), Array(4).fill('GRASS'));
  const after = JSON.stringify(state.mapDefinition);
  undoMap();
  assert.equal(JSON.stringify(state.mapDefinition), before);
  assert.equal(env.elements['btn-undo-map'].disabled, true);
  redoMap();
  assert.equal(JSON.stringify(state.mapDefinition), after);
  const cell = env.document.getElementById('editor-cell-4-7');
  cell.dispatchEvent({ type: 'pointerenter', pointerType: 'mouse' });
  const oldPeakGhost = env.document.getElementById('editor-cell-4-6').querySelectorAll('.placement-ghost')[0];
  assert.equal(oldPeakGhost.classList.contains('type-MOUNTAIN'), true);
  assert.equal(cell.classList.contains('placement-valid'), true);
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
