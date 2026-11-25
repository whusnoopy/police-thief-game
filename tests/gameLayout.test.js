import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";
const env = createTestEnvironment();
env.installGlobals();
const { els } = await import("../src/app/state.js");
const { renderGameLayout } = await import("../src/ui/game/gameLayout.js");
const { renderAppShell } = await import("../src/app/appShellRenderer.js");
const { getAppShellState } = await import("../src/app/appShellState.js");

test("shared header moves cleanly across editor, map list, and isometric gameplay shells", () => {
  for (let i = 0; i < 2; i += 1) {
    renderAppShell(getAppShellState({ mode: "EDITOR" }));
    assert.equal(els.appHeader.parentNode, els.editorHeaderSlot);
    assert.equal(els.appHeaderHome.classList.contains("hidden"), true);
    assert.equal(document.body.classList.contains("editor-playing"), true);

    renderAppShell(getAppShellState({ mode: "MAP_LIST" }));
    assert.equal(els.appHeader.parentNode, els.appHeaderHome);
    assert.equal(els.appHeaderHome.classList.contains("hidden"), false);

    renderAppShell(getAppShellState({ mode: "EDITOR" }));
    renderAppShell(getAppShellState({ mode: "GAME" }));
    renderGameLayout(true);
    assert.equal(els.appHeader.parentNode, els.isoHeaderSlot);
    assert.equal(els.appHeaderHome.classList.contains("hidden"), true);
    assert.equal(document.body.classList.contains("isometric-playing"), true);
    assert.equal(document.body.classList.contains("editor-playing"), false);

    renderGameLayout(false);
    assert.equal(els.appHeader.parentNode, els.appHeaderHome);
    assert.equal(document.body.classList.contains("isometric-playing"), false);
    renderAppShell(getAppShellState({ mode: "EDITOR" }));
    assert.equal(els.appHeader.parentNode, els.editorHeaderSlot);
  }
});

test("toggling isometric gameplay layout preserves live header controls without duplicating handlers", () => {
  let clicks = 0;
  els.btnRollDice.addEventListener("click", () => { clicks += 1; });
  for (let n = 0; n < 2; n += 1) {
    renderGameLayout(true);
    assert.equal(els.appHeader.parentNode, els.isoHeaderSlot);
    assert.equal(document.body.classList.contains("isometric-playing"), true);
    els.btnRollDice.click();
    renderGameLayout(false);
    assert.equal(els.appHeader.parentNode, els.appHeaderHome);
    assert.equal(document.body.classList.contains("isometric-playing"), false);
  }
  assert.equal(clicks, 2);
});
