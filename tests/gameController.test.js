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

test("animal units render on the game board", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "POLICE_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 3, "THIEF_SPAWN");

  gameController.init(mapDefinition);
  gameController.session.animalUnits.push({ id: "A1", r: 0, c: 1, emoji: "🐮" });
  gameController.renderGameBoard();

  assert.equal(env.elements["game-board"].querySelectorAll(".animal-token").length, 1);
});

test("farm animal spawns rerender after a full round", () => {
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const mapDefinition = createEmptyMapDefinition();
    setLegacyTileAt(mapDefinition, 0, 0, "POLICE_SPAWN");
    setLegacyTileAt(mapDefinition, 0, 3, "THIEF_SPAWN");
    setLegacyTileAt(mapDefinition, 1, 1, "FARM");
    setLegacyTileAt(mapDefinition, 0, 1, "BUILDING");
    setLegacyTileAt(mapDefinition, 1, 0, "BUILDING");
    setLegacyTileAt(mapDefinition, 1, 2, "BUILDING");

    gameController.init(mapDefinition);
    gameController.turn = "POLICE";
    gameController.session.turn = "POLICE";
    gameController.advanceTurn();

    assert.equal(gameController.session.animalUnits.length, 1);
    assert.equal(env.elements["game-board"].querySelectorAll(".animal-token").length, 1);
  } finally {
    Math.random = originalRandom;
  }
});
