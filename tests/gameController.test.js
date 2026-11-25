import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";
import { DIRECTIONAL_SIGNAL_RULES } from "../src/domain/map/mapCompatibility.js";
import { createNewMapDefinition } from "../src/domain/map/mapModel.js";

const env = createTestEnvironment();
env.installGlobals();

const { createEmptyMapDefinition, setLegacyTileAt } = await import(
  "../src/domain/map/mapModel.js"
);
const { els } = await import("../src/app/state.js");
const { GAME_PHASES, gameController } = await import("../src/features/gameController.js");

test("crosswalk signal poles update in place on signal phase change while preserving static SVG", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "POLICE_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 3, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "CROSSWALK_HORIZONTAL");

  gameController.init(mapDefinition);
  const svgBefore = env.elements["game-board"].querySelectorAll(".iso-canvas")[0];
  const groundBefore = env.elements["game-board"].querySelectorAll(".iso-ground")[0];

  const countSignals = (color) => env.elements["game-board"]
    .querySelectorAll(".iso-crosswalk-signal")
    .filter((node) => node.classList.contains(color)).length;

  assert.equal(countSignals("green"), 2);
  assert.equal(countSignals("red"), 0);

  gameController.turn = "POLICE";
  gameController.session.turn = "POLICE";
  gameController.advanceTurn();

  assert.equal(env.elements["game-board"].querySelectorAll(".iso-canvas")[0], svgBefore);
  assert.equal(env.elements["game-board"].querySelectorAll(".iso-ground")[0], groundBefore);
  assert.equal(countSignals("green"), 0);
  assert.equal(countSignals("red"), 2);
  gameController.dispose();
});

test("adjacent same-axis crosswalks omit interior signal poles in gameplay", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "POLICE_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 5, "THIEF_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 1, "CROSSWALK_HORIZONTAL");
  setLegacyTileAt(mapDefinition, 0, 2, "CROSSWALK_HORIZONTAL");
  setLegacyTileAt(mapDefinition, 0, 3, "CROSSWALK_HORIZONTAL");

  gameController.init(mapDefinition);

  const poles = env.elements["game-board"].querySelectorAll(".iso-signal");
  assert.equal(poles.length, 2);
  assert.deepEqual(
    poles.map((pole) => [Number(pole.attributes["data-r"]), Number(pole.attributes["data-c"])]),
    [[0, 1], [0, 3]],
  );
  gameController.dispose();
});

test("directional crossing lights and status alternate together after full police turns", () => {
  const map = createNewMapDefinition();
  map.signalRules = DIRECTIONAL_SIGNAL_RULES;
  setLegacyTileAt(map, 8, 8, "CROSSWALK_HORIZONTAL");
  setLegacyTileAt(map, 8, 9, "CROSSWALK_VERTICAL");
  try {
    gameController.init(map);
    const check = (direction, horizontal, vertical, phaseClass) => {
      const signals = els.gameBoard.querySelectorAll(".iso-crosswalk-signal");
      assert.match(els.signalIndicator.textContent, direction);
      assert.equal(els.signalIndicator.classList.contains(phaseClass), true);
      assert.equal(els.signalIndicator.classList.contains("pedestrian-go"), false);
      assert.equal(els.signalIndicator.classList.contains("car-go"), false);
      for (const signal of signals) {
        const axis = ["E", "W"].includes(signal.attributes["data-facing"]) ? horizontal : vertical;
        assert.equal(signal.classList.contains(axis), true);
      }
      assert.equal(signals.length, 4);
    };
    check(/南北向通行/, "red", "green", "north-south-go");
    gameController.advanceTurn();
    check(/南北向通行/, "red", "green", "north-south-go");
    gameController.advanceTurn();
    check(/东西向通行/, "green", "red", "east-west-go");
    gameController.advanceTurn();
    gameController.advanceTurn();
    check(/南北向通行/, "red", "green", "north-south-go");
    assert.equal(gameController.session.revision, 2);
  } finally {
    gameController.dispose();
  }
});

function makePlayableMap() {
  const map = createEmptyMapDefinition();
  [[9, 9, "POLICE_SPAWN"], [0, 0, "THIEF_SPAWN"], [0, 1, "BANK"], [0, 2, "THIEF_BASE"]]
    .forEach(([r, c, tile]) => setLegacyTileAt(map, r, c, tile));
  return map;
}

function tap(r, c, pointerType = "touch") {
  gameController.handleCellClick(r, c, { previewOnly: pointerType === "touch" || pointerType === "pen" });
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
  gameController.dispose();
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
  gameController.dispose();
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
  gameController.dispose();
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

test("animal units render on the isometric game board", () => {
  const mapDefinition = createEmptyMapDefinition();
  setLegacyTileAt(mapDefinition, 0, 0, "POLICE_SPAWN");
  setLegacyTileAt(mapDefinition, 0, 3, "THIEF_SPAWN");

  gameController.init(mapDefinition);
  gameController.session.animalUnits.push({ id: "A1", r: 0, c: 1, emoji: "🐮" });
  gameController.renderGameBoard();

  const animal = env.elements["game-board"].querySelectorAll(".iso-unit")
    .find((node) => node.attributes["data-id"] === "A1");
  assert.ok(animal);
  assert.equal(Number(animal.attributes["data-r"]), 0);
  assert.equal(Number(animal.attributes["data-c"]), 1);
  gameController.dispose();
});

test("farm animal spawns incrementally update on the board after a full round", () => {
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
    const svgBefore = env.elements["game-board"].querySelectorAll(".iso-canvas")[0];
    gameController.turn = "POLICE";
    gameController.session.turn = "POLICE";
    gameController.advanceTurn();

    assert.equal(gameController.session.animalUnits.length, 1);
    assert.equal(env.elements["game-board"].querySelectorAll(".iso-canvas")[0], svgBefore);
    assert.equal(
      env.elements["game-board"].querySelectorAll(".iso-unit").filter((u) => u.attributes["data-id"]?.startsWith("A")).length,
      1,
    );
  } finally {
    Math.random = originalRandom;
    gameController.dispose();
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
  gameController.dispose();
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
  gameController.dispose();
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
  gameController.dispose();
});

test("same actor and cancel button deselect without spending dice or retaining a pending move", () => {
  const map = makePlayableMap();
  setLegacyTileAt(map, 5, 5, "THIEF_SPAWN");
  gameController.init(map);
  gameController.diceValue = 3;
  gameController.onDiceRolled();
  const unit = gameController.thiefUnits[0];
  const moves = gameController.calculateReachableForUnit(unit);
  const snapshot = JSON.stringify(gameController.session);
  for (const cancel of [() => gameController.handleCellClick(0, 0), () => els.btnCancelSelection.click()]) {
    gameController.handleCellClick(0, 0);
    gameController.handleCellClick(0, 1, { previewOnly: true });
    assert.ok(gameController.pendingDestination);
    cancel();
    assert.equal(gameController.selectedUnit, null);
    assert.equal(gameController.phase, GAME_PHASES.SELECT_UNIT);
    assert.equal(gameController.pendingDestination, null);
    assert.equal(gameController.pathDestination, null);
    assert.equal(gameController.reachable.size, 0);
    assert.equal(gameController.calculateReachableForUnit(unit), moves);
    assert.equal(JSON.stringify(gameController.session), snapshot);
    assert.equal(env.elements["game-board"].querySelectorAll(".selectable-unit").length, 2);
    assert.ok(els.btnCancelSelection.classList.contains("hidden"));
    gameController.confirmMove();
    assert.equal(gameController.turn, "THIEF");
  }
  gameController.handleCellClick(5, 5);
  gameController.handleCellClick(5, 6);
  assert.equal(gameController.thiefUnits[1].c, 6);
  assert.equal(gameController.turn, "POLICE");
  gameController.dispose();
});

test("other actionable actors stay clickable during destination selection", () => {
  const map = makePlayableMap();
  setLegacyTileAt(map, 5, 5, "THIEF_SPAWN");
  gameController.init(map);
  gameController.diceValue = 2;
  gameController.onDiceRolled();
  gameController.handleCellClick(0, 0);
  assert.equal(env.elements["game-board"].querySelectorAll(".selectable-unit").length, 2);
  gameController.handleCellClick(5, 5);
  assert.equal(gameController.selectedUnit.id, "T2");
  gameController.handleCellClick(0, 0);
  assert.equal(gameController.selectedUnit.id, "T1");
  gameController.dispose();
});
