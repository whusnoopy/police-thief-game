import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";

const env = createTestEnvironment();
env.installGlobals();

const { setMapDefinition, state } = await import("../src/app/state.js");
const { createEmptyMapDefinition, setLegacyTileAt } = await import(
  "../src/domain/map/mapModel.js"
);
const { initEditor, renderEditorBoard } = await import("../src/features/editorController.js");

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
  validCenter.dispatchEvent({ type: "mouseenter" });

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

  validCenter.dispatchEvent({ type: "mousedown" });

  assert.equal(state.mapDefinition.terrain[4][4], "MOUNTAIN");
  assert.equal(state.mapDefinition.terrain[4][5], "GRASS");

  const blockedMap = createEmptyMapDefinition();
  setLegacyTileAt(blockedMap, 4, 5, "BANK");
  setMapDefinition(blockedMap);
  renderEditorBoard();

  const invalidCenter = env.document.getElementById("editor-cell-4-4");
  invalidCenter.dispatchEvent({ type: "mouseenter" });

  assert.equal(invalidCenter.classList.contains("placement-invalid"), true);
  assert.equal(
    invalidCenter.querySelectorAll(".placement-ghost")[0].classList.contains("type-MOUNTAIN"),
    true,
  );

  invalidCenter.dispatchEvent({ type: "mousedown" });

  assert.equal(state.mapDefinition.terrain[4][4], "ROAD");
  assert.equal(state.mapDefinition.features[0].kind, "BANK");

  state.currentPaletteType = "BANK";
  setMapDefinition(createEmptyMapDefinition());
  renderEditorBoard();

  const bankCell = env.document.getElementById("editor-cell-2-2");
  bankCell.dispatchEvent({ type: "mouseenter" });
  const bankGhost = bankCell.querySelectorAll(".placement-ghost")[0];

  assert.equal(bankCell.classList.contains("placement-valid"), true);
  assert.equal(env.elements["editor-board"].querySelectorAll(".placement-ghost").length, 1);
  assert.equal(bankGhost.classList.contains("type-BANK"), true);
  assert.equal(bankGhost.textContent, "🏦");
});
