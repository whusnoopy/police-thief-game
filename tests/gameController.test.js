import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";

const env = createTestEnvironment();
env.installGlobals();

const { createEmptyMapDefinition, setLegacyTileAt } = await import(
  "../src/domain/map/mapModel.js"
);
const { GAME_PHASES, gameController } = await import("../src/features/gameController.js");

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

function makePlayableMap() {
  const map = createEmptyMapDefinition();
  [[9, 9, "POLICE_SPAWN"], [0, 0, "THIEF_SPAWN"], [0, 1, "BANK"], [0, 2, "THIEF_BASE"]]
    .forEach(([r, c, tile]) => setLegacyTileAt(map, r, c, tile));
  return map;
}

function tap(r, c, pointerType = "touch") {
  const cell = env.document.getElementById(`game-cell-${r}-${c}`);
  cell.dispatchEvent({ type: "pointerdown", pointerType });
  cell.dispatchEvent({ type: "click" });
}

test("touch and pen preview safely, cancel preserves the turn, and confirm resolves once", () => {
  gameController.init(makePlayableMap());
  gameController.diceValue = 3;
  gameController.onDiceRolled();
  tap(0, 0);
  tap(0, 1);
  assert.equal(gameController.thiefUnits[0].c, 0);
  assert.equal(gameController.thiefUnits[0].hasMoney, false);
  assert.match(env.elements["move-preview-text"].textContent, /拿到钱/);
  assert.equal(env.elements["move-confirm-actions"].classList.contains("hidden"), false);
  gameController.clearPathHover();
  assert.ok(gameController.pendingDestination);
  gameController.cancelMovePreview();
  assert.equal(gameController.phase, GAME_PHASES.SELECT_DESTINATION);
  assert.equal(gameController.turn, "THIEF");
  tap(0, 1, "pen");
  gameController.confirmMove();
  assert.equal(gameController.thiefUnits[0].c, 1);
  assert.equal(gameController.thiefUnits[0].hasMoney, true);
  assert.equal(gameController.turn, "POLICE");
  assert.match(env.elements["last-action"].textContent, /拿到钱/);
  assert.match(env.elements["last-action"].textContent, /剩余 2 步作废/);
  assert.match(env.elements["unit-counts"].textContent, /活动 1/);
  gameController.confirmMove();
  assert.equal(gameController.turn, "POLICE");
});

test("mouse still moves directly and escape counts and narration survive the final move", () => {
  gameController.init(makePlayableMap());
  gameController.diceValue = 3;
  gameController.onDiceRolled();
  tap(0, 0, "mouse");
  tap(0, 2, "mouse");
  assert.equal(gameController.phase, GAME_PHASES.FINISHED);
  assert.match(env.elements["unit-counts"].textContent, /活动 0.*逃脱 1/);
  assert.match(env.elements["last-action"].textContent, /拿到钱.*成功逃脱/);
});

test("each unit search is reused through highlighting and reselection, then invalidated by turn and dice", () => {
  const map = makePlayableMap();
  setLegacyTileAt(map, 5, 5, "THIEF_SPAWN");
  gameController.init(map);
  const original = gameController.computeReachableForUnit;
  let searches = 0;
  gameController.computeReachableForUnit = function (unit) { searches++; return original.call(this, unit); };
  try {
    gameController.diceValue = 2;
    gameController.onDiceRolled();
    assert.equal(searches, 2);
    gameController.handleCellClick(0, 0);
    gameController.handleCellClick(5, 5);
    gameController.handleCellClick(0, 0);
    assert.equal(searches, 2);
    const first = gameController.calculateReachableForUnit(gameController.thiefUnits[0]);
    gameController.diceValue = 1;
    assert.notEqual(gameController.calculateReachableForUnit(gameController.thiefUnits[0]), first);
    assert.equal(searches, 3);
    gameController.advanceTurn();
    gameController.advanceTurn();
    gameController.diceValue = 1;
    gameController.calculateReachableForUnit(gameController.thiefUnits[0]);
    assert.equal(searches, 4);
    gameController.dispose();
    assert.equal(gameController.reachabilityCache.size, 0);
  } finally { gameController.computeReachableForUnit = original; }
});

test("switching units and restarting clear a pending touch destination", () => {
  const map = makePlayableMap();
  setLegacyTileAt(map, 5, 5, "THIEF_SPAWN");
  gameController.init(map);
  gameController.diceValue = 3;
  gameController.onDiceRolled();
  tap(0, 0); tap(0, 1); tap(5, 5);
  gameController.confirmMove();
  assert.equal(gameController.thiefUnits[0].c, 0);
  assert.equal(gameController.thiefUnits[1].c, 5);
  assert.equal(gameController.pendingDestination, null);
  tap(5, 6);
  gameController.init(map);
  gameController.confirmMove();
  assert.equal(gameController.phase, GAME_PHASES.AWAIT_ROLL);
  assert.equal(gameController.pendingDestination, null);
});

test("background search waits for results, reuses them and ignores completion after restart", async () => {
  const original = gameController.createSearchJob;
  let finish;
  gameController.createSearchJob = () => ({ promise: new Promise((resolve) => { finish = resolve; }), cancel() {} });
  try {
    gameController.init(makePlayableMap());
    gameController.diceValue = 3;
    const unit = gameController.thiefUnits[0];
    const moves = gameController.computeReachableForUnit(unit);
    const pending = gameController.onDiceRolled();
    assert.equal(gameController.phase, GAME_PHASES.CALCULATING);
    gameController.handleCellClick(0, 0);
    assert.equal(gameController.selectedUnit, null);
    finish(new Map([[unit.id, moves]]));
    await pending;
    assert.equal(gameController.phase, GAME_PHASES.SELECT_UNIT);
    assert.equal(gameController.calculateReachableForUnit(unit), moves);

    const stale = gameController.onDiceRolled();
    gameController.init(makePlayableMap());
    finish(new Map([[unit.id, moves]]));
    await stale;
    assert.equal(gameController.phase, GAME_PHASES.AWAIT_ROLL);
    assert.equal(gameController.reachabilityCache.size, 0);

    gameController.diceValue = 3;
    const failed = gameController.onDiceRolled();
    finish(null);
    await failed;
    assert.equal(gameController.phase, GAME_PHASES.SELECT_UNIT);
  } finally { gameController.createSearchJob = original; gameController.dispose(); }
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

test("reinitializing the game cancels an in-flight dice animation", () => {
  const mapDefinition = createEmptyMapDefinition();
  gameController.rollIntervalId = setInterval(() => {}, 1000);
  gameController.isRolling = true;
  gameController.phase = GAME_PHASES.ROLLING;

  gameController.init(mapDefinition);

  assert.equal(gameController.rollIntervalId, null);
  assert.equal(gameController.isRolling, false);
  assert.equal(gameController.phase, GAME_PHASES.AWAIT_ROLL);
});

test("skip turn only works after the rolled side has no legal moves", () => {
  const mapDefinition = createEmptyMapDefinition();
  gameController.init(mapDefinition);
  const initialTurn = gameController.turn;

  gameController.skipTurn();
  assert.equal(gameController.turn, initialTurn);

  gameController.phase = GAME_PHASES.NO_MOVES;
  gameController.skipTurn();
  assert.notEqual(gameController.turn, initialTurn);
});

test("skipping a permanently blocked game finishes as a draw", () => {
  const map = createEmptyMapDefinition({ terrain: Array.from({ length: 10 }, () => Array(10).fill("BUILDING")) });
  setLegacyTileAt(map, 0, 0, "THIEF_SPAWN");
  setLegacyTileAt(map, 9, 9, "POLICE_SPAWN");
  gameController.init(map);
  gameController.phase = GAME_PHASES.NO_MOVES;
  gameController.skipTurn();
  assert.equal(gameController.phase, GAME_PHASES.FINISHED);
  assert.match(env.elements["victory-title"].textContent, /平局/);
});
