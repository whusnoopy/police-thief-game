import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";
import { createNewMapDefinition, createRampMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { encodeMapDefinition, decodeMapDefinition } from "../src/domain/map/mapCodec.js";
const env=createTestEnvironment();env.installGlobals();
const { initEditor, renderEditorBoard, undoMap, redoMap, clearMap, createExpansionCopy, finishMapExpansion }=await import("../src/features/editorController.js");
const { state,setMapDefinition,els }=await import("../src/app/state.js");
const { persistCurrentMap, getCurrentMapId, getMapList }=await import("../src/storage/mapRepository.js");
const { gameController:game }=await import("../src/features/gameController.js");
initEditor();

test("20×20 editor paints the last cell, retains dimensions through undo/redo/clear and never paints while panning",()=>{
  state.mode="EDITOR";setMapDefinition(createNewMapDefinition());renderEditorBoard();
  assert.equal(els.editorBoard.children.length,376);assert.equal(els.editorBoard.dataset.cols,20);
  assert.equal(env.document.getElementById("editor-cell-0-0"),null);
  assert.equal(env.document.getElementById("editor-cell-0-3").style.gridColumnStart,4);
  assert.equal(env.document.getElementById("editor-cell-19-16").style.gridRowStart,20);
  state.currentPaletteType="MOUNTAIN";
  const paint=()=>{env.document.getElementById("editor-cell-19-16").dispatchEvent({type:"pointerdown",button:0,pointerId:1});env.document.dispatchEvent({type:"pointerup",pointerId:1});};
  paint();assert.equal(state.mapDefinition.terrain[19][16],"MOUNTAIN");assert.equal(state.mapDefinition.terrain[18][16],"GRASS");
  assert.match(els.editorMapPosition.textContent,/20 行.*17 列/);
  undoMap();assert.equal(state.mapDefinition.terrain[19][16],"ROAD");assert.equal(state.mapDefinition.meta.rows,20);
  redoMap();assert.equal(state.mapDefinition.terrain[19][16],"MOUNTAIN");
  els.btnEditorPan.click();state.currentPaletteType="GRASS";paint();assert.equal(state.mapDefinition.terrain[19][16],"MOUNTAIN");
  els.btnEditorPaint.click();clearMap();assert.equal(state.mapDefinition.meta.rows,20);assert.equal(els.editorBoard.children.length,376);
  undoMap();assert.equal(state.mapDefinition.terrain[19][16],"MOUNTAIN");assert.equal(decodeMapDefinition(encodeMapDefinition(state.mapDefinition)).meta.rows,20);
});

test("explicit editor expansion creates a distinct record, requires review and restores review state with history",()=>{
  const old=createRampMapDefinition();
  for(const[r,c,t]of [[0,0,"POLICE_SPAWN"],[9,9,"THIEF_SPAWN"],[9,8,"BANK"],[8,9,"THIEF_BASE"]])setLegacyTileAt(old,r,c,t);
  setMapDefinition(old);persistCurrentMap({forceNewMap:true,mapName:"原图"});renderEditorBoard();
  const id=getCurrentMapId(),original=structuredClone(getMapList().find(m=>m.id===id));
  assert.ok(env.document.getElementById("btn-expand-map"));createExpansionCopy();
  assert.notEqual(getCurrentMapId(),id);assert.deepEqual(getMapList().find(m=>m.id===id),original);
  assert.equal(state.mapDefinition.meta.rows,20);assert.equal(state.mapDefinition.expansion.status,"editing");assert.equal(finishMapExpansion(),true);
  assert.equal(state.mapDefinition.expansion.status,"ready");
  state.currentPaletteType="GRASS";env.document.getElementById("editor-cell-19-16").dispatchEvent({type:"pointerdown",button:0,pointerId:2});env.document.dispatchEvent({type:"pointerup",pointerId:2});
  assert.equal(state.mapDefinition.expansion.status,"editing");undoMap();assert.equal(state.mapDefinition.expansion.status,"ready");redoMap();assert.equal(state.mapDefinition.expansion.status,"editing");
  assert.deepEqual(getMapList().find(m=>m.id===id),original);
});

test("20×20 game renders every surface, focuses the far-edge actor and preserves preview across views",async()=>{
  const map=createNewMapDefinition({ actionRules: "single" });for(const[r,c,t]of [[0,3,"POLICE_SPAWN"],[19,16,"THIEF_SPAWN"],[19,15,"BANK"],[18,16,"THIEF_BASE"]])setLegacyTileAt(map,r,c,t);
  game.boardMode="isometric";game.init(map);game.diceValue=2;await game.onDiceRolled();
  assert.equal(els.gameBoard.querySelectorAll(".iso-surface").length,376);
  assert.equal(game.boardViewState.zoom,1,"a new game starts with the full map");
  const overview={x:game.boardViewState.centerX,y:game.boardViewState.centerY};
  game.handleCellClick(19,16);game.handleCellClick(19,15,{previewOnly:true});
  els.btnBoardFit.click();assert.equal(game.boardViewState.zoom,1);els.btnBoardFocus.click();
  assert.ok(game.boardViewState.centerX>0);assert.ok(game.boardViewState.centerY>0);
  assert.notDeepEqual({x:game.boardViewState.centerX,y:game.boardViewState.centerY},overview,"focus remains an explicit action");
  game.setBoardMode("topdown");assert.equal(els.gameBoard.querySelectorAll(".cell").length,376);
  game.setBoardMode("isometric");assert.deepEqual(game.pendingDestination,{r:19,c:15});game.confirmMove();
  assert.equal(game.thiefUnits[0].hasMoney,true);assert.equal(game.thiefUnits[0].c,15);assert.equal(game.turn,"POLICE");
  game.dispose();game.boardMode="topdown";
});
