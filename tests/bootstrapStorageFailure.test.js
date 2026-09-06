import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";
const env = createTestEnvironment();
env.installGlobals();
env.localStorage.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
const { init } = await import("../src/app/bootstrap.js");
const { state } = await import("../src/app/state.js");
const { setLegacyTileAt } = await import("../src/domain/map/mapModel.js");
const { gameController } = await import("../src/features/gameController.js");

test("storage failures do not prevent rendering, editing, or starting a playable game", () => {
  assert.doesNotThrow(init);
  assert.equal(env.elements["editor-board"].children.length, 100);
  env.document.getElementById("editor-cell-0-0").dispatchEvent({ type: "pointerdown", button: 0, pointerId: 1 });
  env.document.dispatchEvent({ type: "pointerup", pointerId: 1 });
  assert.equal(state.mapDefinition.terrain[0][0], "GRASS");
  [[0, 0, "POLICE_SPAWN"], [9, 9, "THIEF_SPAWN"], [5, 5, "BANK"], [9, 0, "THIEF_BASE"]]
    .forEach(([r, c, type]) => setLegacyTileAt(state.mapDefinition, r, c, type));
  env.elements["btn-start-game"].click();
  assert.equal(state.mode, "GAME");
  assert.ok(gameController.session);
  assert.equal(env.elements["storage-notice"].classList.contains("hidden"), false);
});
