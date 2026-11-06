import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";
import { createRampScenario } from "./helpers/rampScenario.js";
const env = createTestEnvironment();
env.installGlobals();
const { gameController: game, GAME_PHASES } = await import("../src/features/gameController.js");
const board = env.elements["game-board"];

function begin(direction = "E") {
  const scenario = createRampScenario(direction);
  game.boardMode = "topdown";
  game.init(scenario.map);
  game.thiefUnits[0].inCar = true;
  game.diceValue = 2;
  game.onDiceRolled();
  return scenario;
}

test("switching views preserves the rolled turn, selected unit, reachable actions and touch preview; confirmation resolves once", () => {
  const { positions } = begin();
  game.handleCellClick(positions.start.r, positions.start.c);
  game.handleCellClick(positions.end.r, positions.end.c, { previewOnly: true });
  const session = game.session, selected = game.selectedUnit, reachable = game.reachable;
  env.elements["btn-view-isometric"].click();
  assert.equal(game.session, session);
  assert.equal(game.selectedUnit, selected);
  assert.equal(game.reachable, reachable);
  assert.equal(game.diceValue, 2);
  assert.equal(game.phase, GAME_PHASES.SELECT_DESTINATION);
  assert.ok(board.querySelectorAll(".iso-step-badge").length > 0);
  assert.equal(board.querySelectorAll(".unit-selected").length, 1);
  env.elements["btn-view-topdown"].click();
  assert.ok(board.querySelectorAll(".path-badge-temp").length > 0);
  env.elements["btn-view-isometric"].click();
  game.confirmMove();
  assert.equal(selected.hasMoney, true);
  assert.deepEqual({ r: selected.r, c: selected.c }, positions.end);
  assert.equal(game.turn, "POLICE");
  game.confirmMove();
  assert.equal(game.turn, "POLICE");
  const bankOccupant = board.querySelectorAll(".iso-unit").find(element => element.attributes["data-r"] == positions.end.r && element.attributes["data-c"] == positions.end.c);
  assert.ok(bankOccupant.querySelectorAll(".money").length === 1);
});

test("isometric unit hit targets preserve touch preview, cancellation and all four ramp routes", () => {
  for (const direction of ["N", "E", "S", "W"]) {
    const { positions } = begin(direction);
    game.setBoardMode("isometric");
    const token = board.querySelectorAll(".character").find(element => element.dataset.id === "T1");
    token.parentNode.parentNode.dispatchEvent({ type: "click", pointerType: "touch" });
    assert.equal(game.selectedUnit.id, "T1");
    game.handleCellClick(positions.deck.r, positions.deck.c, { previewOnly: true });
    assert.equal(game.thiefUnits[0].r, positions.start.r);
    game.cancelMovePreview();
    assert.equal(game.pendingDestination, null);
    assert.equal(board.querySelectorAll(".iso-step-badge").length, 0);
    game.handleCellClick(positions.end.r, positions.end.c, { previewOnly: true });
    game.confirmMove();
    assert.equal(game.thiefUnits[0].hasMoney, true);
  }
});

test("switching while background moves are calculated keeps the job and renders its result in the current view", async () => {
  begin();
  let finish;
  const original = game.createSearchJob;
  game.createSearchJob = () => ({ promise: new Promise(resolve => { finish = resolve; }), cancel() { assert.fail("view switch cancelled the search"); } });
  try {
    const done = game.onDiceRolled();
    game.setBoardMode("isometric");
    assert.equal(game.phase, GAME_PHASES.CALCULATING);
    finish(new Map([["T1", new Map([["4,4", {}]])]]));
    await done;
    assert.equal(game.phase, GAME_PHASES.SELECT_UNIT);
    assert.equal(board.querySelectorAll(".selectable-unit").length, 1);
  } finally { game.createSearchJob = original; }
});

test("isometric rendering has readable asset fallbacks and excludes escaped or jailed thieves", () => {
  begin();
  game.thiefUnits.push({ id: "T2", r: 1, c: 1, state: "JAILED" });
  game.thiefUnits.push({ id: "T3", r: 2, c: 1, state: "ESCAPED" });
  game.setBoardMode("isometric");
  assert.equal(board.querySelectorAll(".character").length, 2);
  const image = board.querySelectorAll(".story-sprite")[0];
  image.dispatchEvent({ type: "error" });
  assert.equal(board.querySelectorAll(".story-fallback").length, 1);
  game.dispose();
  assert.equal(board.children.length, 0);
  assert.equal(game.boardView, null);
});
