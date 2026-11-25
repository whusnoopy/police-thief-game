import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { renderBoard } from "../src/ui/board/boardRenderer.js";
import { renderRoleLabel } from "../src/ui/game/roleArtwork.js";

const env = createTestEnvironment();
env.installGlobals();

test("2D editor and thumbnail storybook art renders facilities, spawns, and role portraits cleanly", () => {
  const map = createEmptyMapDefinition();
  setLegacyTileAt(map, 0, 0, "BANK");
  setLegacyTileAt(map, 0, 1, "PARKING");
  setLegacyTileAt(map, 0, 2, "POLICE_SPAWN");
  setLegacyTileAt(map, 0, 3, "THIEF_SPAWN");
  renderBoard(env.elements["editor-board"], { mapDefinition: map, cellIdPrefix: "art" });

  const bank = env.document.getElementById("art-0-0");
  assert.equal(bank.querySelectorAll(".tile-art").length, 1);
  assert.match(bank.querySelectorAll(".tile-art")[0].src, /bank\.webp/);
  assert.equal(env.document.getElementById("art-0-1").querySelectorAll(".parking-sign").length, 1);
  assert.equal(env.document.getElementById("art-0-2").querySelectorAll(".police-sign").length, 1);
  assert.equal(env.document.getElementById("art-0-3").querySelectorAll(".thief-sign").length, 1);

  const label = env.document.createElement("h3");
  renderRoleLabel(label, "police", "警察回合");
  assert.match(label.querySelectorAll("img")[0].src, /police\.webp/);
  assert.match(label.textContent, /警察回合/);
});

test("missing storybook sprite falls back to readable Chinese tile text", () => {
  const map = createEmptyMapDefinition();
  setLegacyTileAt(map, 0, 0, "BANK");
  renderBoard(env.elements["editor-board"], { mapDefinition: map, cellIdPrefix: "art" });
  const bank = env.document.getElementById("art-0-0");
  bank.querySelectorAll(".tile-art")[0].dispatchEvent({ type: "error" });
  assert.equal(bank.querySelectorAll(".story-fallback")[0].textContent, "银行");
});
