import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";
const env=createTestEnvironment();env.installGlobals();
const { els }=await import("../src/app/state.js");
const { renderGameLayout, revealActionPanel }=await import("../src/ui/game/gameLayout.js");
const { renderAppShell }=await import("../src/app/appShellRenderer.js");
const { getAppShellState }=await import("../src/app/appShellState.js");

test("editor branding shares the sidebar and restores its home through library and both game views",()=>{
  for (let i=0;i<2;i++) {
    renderAppShell(getAppShellState({mode:"EDITOR"}));
    assert.equal(els.appHeader.parentNode,els.editorHeaderSlot);
    assert.equal(els.appHeaderHome.classList.contains("hidden"),true);
    assert.equal(document.body.classList.contains("editor-playing"),true);
    renderAppShell(getAppShellState({mode:"MAP_LIST"}));
    assert.equal(els.appHeader.parentNode,els.appHeaderHome);
    assert.equal(els.appHeaderHome.classList.contains("hidden"),false);
    renderAppShell(getAppShellState({mode:"EDITOR"}));
    renderAppShell(getAppShellState({mode:"GAME"}));renderGameLayout(false);
    assert.equal(els.appHeader.parentNode,els.appHeaderHome);
    assert.equal(document.body.classList.contains("editor-playing"),false);
    renderGameLayout(true);
    assert.equal(els.appHeader.parentNode,els.isoInfoContent);
    renderGameLayout(false);renderAppShell(getAppShellState({mode:"EDITOR"}));
    assert.equal(els.appHeader.parentNode,els.editorHeaderSlot);
  }
  renderAppShell(getAppShellState({mode:"GAME"}));renderGameLayout(false);
});

test("four corner panels retain live controls and restore the 2D hierarchy after view switches and collapse",()=>{
  els.gameDicePanel.appendChild(els.btnRollDice);
  els.gameActions.appendChild(els.btnViewRules);
  let rolls=0;els.btnRollDice.addEventListener("click",()=>rolls++);
  const button=els.btnRollDice,preview=els.movePreview;
  for(let n=0;n<2;n++){
    renderGameLayout(true);
    assert.equal(els.appHeader.parentNode,els.isoInfoContent);
    assert.equal(els.gameActions.parentNode,els.isoInfoContent);
    assert.equal(els.gameStatusPanel.parentNode,els.isoStatusContent);
    assert.equal(els.unitCounts.parentNode,els.isoStatusContent);
    assert.equal(els.gameDicePanel.parentNode,els.isoDiceContent);
    assert.equal(els.gameActionDetails.parentNode,els.isoProgressContent);
    assert.equal(els.boardZoomControls.parentNode,els.isoStatusZoom);
    assert.equal(els.btnRollDice,button);button.click();
    els.isoPanelProgress.open=false;revealActionPanel();assert.equal(els.isoPanelProgress.open,true);
    renderGameLayout(true,true);
    assert.equal(els.boardZoomControls.parentNode,els.gameMapZoomSlot);
    assert.equal(document.body.classList.contains("isometric-sidebar-collapsed"),true);
    renderGameLayout(false);
    assert.equal(els.appHeader.parentNode,els.appHeaderHome);
    assert.equal(els.gameDicePanel.parentNode,els.gameSidebar);
    assert.equal(els.gameStatusPanel.parentNode,els.gameSidebar);
    assert.equal(els.gameActions.parentNode,els.gameSidebar);
    assert.equal(els.gameSidebar.children.at(-1),els.gameActions);
    assert.equal(els.gameActionDetails.parentNode,els.boardFeedbackHome);
    assert.equal(els.boardZoomControls.parentNode,els.boardToolbar);
    assert.equal(els.isoPanelDice.classList.contains("hidden"),true);
    assert.equal(document.body.classList.contains("isometric-playing"),false);
    assert.equal(els.movePreview,preview);
  }
  assert.equal(rolls,2,"moving a live control neither loses nor duplicates its handler");
});
