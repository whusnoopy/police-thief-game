import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";

const env = createTestEnvironment();
env.installGlobals();

const { createEmptyMapDefinition, setLegacyTileAt } = await import(
  "../src/domain/map/mapModel.js"
);
const { gameController } = await import("../src/features/gameController.js");

test("crosswalk signal lights rerender on signal phase change", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "POLICE_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 3, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "CROSSWALK_HORIZONTAL");

  gameController.init(mapDefinition);

  assert.equal(env.elements["game-board"].querySelectorAll(".green").length, 2);
  assert.equal(env.elements["game-board"].querySelectorAll(".red").length, 0);

  gameController.turn = "POLICE";
  gameController.session.turn = "POLICE";
  gameController.advanceTurn();

  assert.equal(env.elements["game-board"].querySelectorAll(".green").length, 0);
  assert.equal(env.elements["game-board"].querySelectorAll(".red").length, 2);
});
