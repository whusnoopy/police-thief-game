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
  assert.equal(bankOccupant.attributes["data-placement"], "driveway");
  const bankLabel = board.querySelectorAll(".iso-actor-label").find(e => e.attributes["data-id"] === "T1");
  assert.equal(bankLabel.querySelectorAll(".money").length, 1);
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
  const image = board.querySelectorAll(".story-sprite").find(element => element.tagName === "IMG");
  image.dispatchEvent({ type: "error" });
  assert.equal(board.querySelectorAll(".story-fallback").length, 1);
  game.dispose();
  assert.equal(board.children.length, 0);
  assert.equal(game.boardView, null);
});

test("driving direction follows the final step and survives view changes, while a new game resets it", () => {
  for (const direction of ["N","E","S","W"]) {
    const {positions,map}=begin(direction);
    game.setBoardMode("isometric");
    game.handleCellClick(positions.start.r,positions.start.c);
    game.handleCellClick(positions.end.r,positions.end.c);
    assert.equal(game.unitDirections.get("T1"),direction);
    const occupant=board.querySelectorAll(".iso-unit").find(e=>e.attributes["data-r"]==positions.end.r&&e.attributes["data-c"]==positions.end.c);
    assert.equal(occupant.querySelectorAll(".iso-vehicle-art")[0].attributes["data-direction"],direction);
    assert.equal("direction" in game.thiefUnits[0],false);
    game.setBoardMode("topdown");game.setBoardMode("isometric");
    assert.equal(game.unitDirections.get("T1"),direction);
    game.init(map);
    assert.equal(game.unitDirections.size,0);
  }
});

test("raised grass and lowered water retain surface-aligned previews and resolved unit positions across views", async () => {
  const { createRampMapDefinition, setLegacyTileAt } = await import("../src/domain/map/mapModel.js");
  const { createIsometricProjection, projectSurfacePoint } = await import("../src/ui/isometric/projection.js");
  const projection = createIsometricProjection();
  for (const type of ["GRASS", "RIVER"]) {
    const map = createRampMapDefinition();
    for (const [r, c, tile] of [[4, 3, "THIEF_SPAWN"], [4, 4, type], [9, 9, "POLICE_SPAWN"], [0, 1, "BANK"], [0, 2, "THIEF_BASE"]]) setLegacyTileAt(map, r, c, tile);
    game.boardMode = "isometric";
    game.init(map);
    game.thiefUnits[0].inCar = type === "RIVER";
    game.renderGameBoard();
    game.diceValue = 2;
    game.onDiceRolled();
    game.handleCellClick(4, 3);
    game.handleCellClick(4, 4, { previewOnly: true });
    const first = projectSurfacePoint({ r: 4, c: 3, tileType: "ROAD" }, 0, 0.5, projection);
    const next = projectSurfacePoint({ r: 4, c: 4, tileType: type }, 0, -0.5, projection);
    const centre = projectSurfacePoint({ r: 4, c: 4, tileType: type }, 0, 0, projection);
    for (const mode of ["isometric", "topdown", "isometric"]) {
      game.setBoardMode(mode);
      assert.deepEqual(game.pendingDestination, { r: 4, c: 4 });
      if (mode !== "isometric") continue;
      const lines = board.querySelectorAll(".iso-path-line");
      assert.equal(lines.length, 3);
      assert.equal(+lines[1].attributes.y1, first.y);
      assert.equal(+lines[1].attributes.y2, next.y);
      assert.equal(+lines[2].attributes.y1, next.y);
      assert.equal(+lines[2].attributes.y2, centre.y);
    }
    game.confirmMove();
    assert.deepEqual({ r: game.thiefUnits[0].r, c: game.thiefUnits[0].c }, { r: 4, c: 4 });
    assert.equal(game.thiefUnits[0].inCar, type === "RIVER");
    assert.equal(game.turn, "POLICE");
    game.dispose();
  }
  game.boardMode = "topdown";
});

test("touch and pen use the original tap point when the browser retargets a water destination to a nearby car", async () => {
  const { createRampMapDefinition, setLegacyTileAt } = await import("../src/domain/map/mapModel.js");
  const { createIsometricProjection, projectSurfacePoint } = await import("../src/ui/isometric/projection.js");
  const projection = createIsometricProjection();
  const map = createRampMapDefinition();
  for (const [r, c, type] of [[4, 3, "THIEF_SPAWN"], [4, 4, "RIVER"], [9, 9, "POLICE_SPAWN"], [0, 1, "BANK"], [0, 2, "THIEF_BASE"]]) setLegacyTileAt(map, r, c, type);
  game.boardMode = "isometric";
  game.init(map);
  game.thiefUnits[0].inCar = true;
  game.renderGameBoard();
  game.diceValue = 2;
  game.onDiceRolled();
  const viewport = board.querySelectorAll(".iso-viewport")[0];
  const svg = board.querySelectorAll(".iso-canvas")[0];
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: projection.width, height: projection.height });
  const token = board.querySelectorAll(".character").find(e => e.dataset.id === "T1");
  const actor = token.parentNode.parentNode;
  const point = projectSurfacePoint({ r: 4, c: 4, tileType: "RIVER" }, 0, 0, projection);
  try {
    for (const pointerType of ["touch", "pen"]) {
      game.handleCellClick(4, 3);
      // The event's target was enlarged by the browser, while precise hit testing
      // sees the SVG surface at the original finger/stylus position.
      env.document.elementFromPoint = () => svg;
      viewport.dispatchEvent({ type: "pointerdown", pointerType, pointerId: 1, clientX: point.x, clientY: point.y, target: actor });
      actor.dispatchEvent({ type: "click", pointerType, clientX: point.x - 6, clientY: point.y - 4 });
      assert.equal(game.selectedUnit.id, "T1");
      assert.deepEqual(game.pendingDestination, { r: 4, c: 4 });
      assert.equal(game.diceValue, 2);
      assert.equal(game.turn, "THIEF");
      game.cancelMovePreview();
      // A real tap on the actor still supports cancelling the selection.
      env.document.elementFromPoint = () => actor;
      viewport.dispatchEvent({ type: "pointerdown", pointerType, pointerId: 2, clientX: point.x - 40, clientY: point.y - 24, target: actor });
      actor.dispatchEvent({ type: "click", pointerType });
      assert.equal(game.selectedUnit, null);
      assert.equal(game.phase, GAME_PHASES.SELECT_UNIT);
    }
  } finally {
    delete env.document.elementFromPoint;
    game.dispose();
    game.boardMode = "topdown";
  }
});

test("foreground identifiers select by keyboard, remain stable during hover and preserve doorway money on arrival and exit", async () => {
  const { createRampMapDefinition, setLegacyTileAt } = await import("../src/domain/map/mapModel.js");
  const map = createRampMapDefinition();
  for (const [r,c,type] of [[0,0,"THIEF_SPAWN"],[9,9,"POLICE_SPAWN"],[0,1,"BANK"],[0,2,"THIEF_BASE"]]) setLegacyTileAt(map,r,c,type);
  game.boardMode="isometric";game.init(map);game.diceValue=3;game.onDiceRolled();
  let label=board.querySelectorAll(".iso-actor-label").find(e=>e.attributes["data-id"]==="T1");
  assert.equal(label.attributes.role,"button");
  label.dispatchEvent({type:"keydown",key:"Enter"});
  assert.equal(game.selectedUnit.id,"T1");
  label=board.querySelectorAll(".iso-actor-label").find(e=>e.attributes["data-id"]==="T1");
  game.handleCellHover(0,1);game.clearPathHover();
  assert.equal(board.querySelectorAll(".iso-actor-label").find(e=>e.attributes["data-id"]==="T1"),label,"hover does not replace the target below a stationary pointer");
  game.handleCellClick(0,1,{previewOnly:true});game.confirmMove();
  let person=board.querySelectorAll(".iso-unit").find(e=>e.querySelectorAll(".thief-token").length);
  assert.equal(person.attributes["data-placement"],"doorway");assert.equal(+person.attributes["data-scale"],.43);
  label=board.querySelectorAll(".iso-actor-label").find(e=>e.attributes["data-id"]==="T1");
  assert.equal(label.querySelectorAll(".money").length,1);
  game.advanceTurn();game.diceValue=1;game.onDiceRolled();game.handleCellClick(0,1);game.handleCellClick(0,0);
  person=board.querySelectorAll(".iso-unit").find(e=>e.querySelectorAll(".thief-token").length);
  assert.equal(person.attributes["data-placement"],"surface");assert.equal(+person.attributes["data-scale"],.86);
  assert.equal(game.thiefUnits[0].hasMoney,true);
  game.dispose();game.boardMode="topdown";
});
