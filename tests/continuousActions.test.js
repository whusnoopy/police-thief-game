import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";
import { createRampMapDefinition, createNewMapDefinition, setLegacyTileAt } from "../src/domain/map/mapModel.js";
import { encodeMapDefinition, decodeMapDefinition } from "../src/domain/map/mapCodec.js";
import { createActionUpgradeCopy } from "../src/domain/map/mapActionUpgrade.js";
import { createMapExpansionDraft } from "../src/domain/map/mapExpansion.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { calculateReachableActions, calculateReachableActionsAsync } from "../src/domain/rules/moveGenerator.js";
import { getUnitOperations } from "../src/domain/rules/unitOperations.js";
import { applyResolvedAction } from "../src/domain/rules/interactionResolver.js";
import { isPermanentStalemate } from "../src/domain/rules/stalemateResolver.js";
import { SIGNAL_PHASES } from "../src/config/constants.js";

const env=createTestEnvironment();env.installGlobals();
const {gameController:g,GAME_PHASES}=await import("../src/features/gameController.js");
const {els,setMapDefinition,state}=await import("../src/app/state.js");
const {initEditor,renderEditorBoard,createContinuousActionCopy,clearMap,undoMap}=await import("../src/features/editorController.js");
const {persistCurrentMap,getMapList,getCurrentMapId}=await import("../src/storage/mapRepository.js");

function fixture(tiles=[]) {
  const map=createRampMapDefinition({actionRules:"continuous"});
  for(const[r,c,t]of [[0,0,"THIEF_SPAWN"],[8,8,"THIEF_SPAWN"],[9,9,"POLICE_SPAWN"],[0,1,"PARKING"],[0,2,"BANK"],[0,4,"THIEF_BASE"],[6,6,"POLICE_STATION"],...tiles])setLegacyTileAt(map,r,c,t);
  return map;
}
async function roll(map=fixture(),dice=4,turn="THIEF") {g.init(map);g.turn=turn;g.diceValue=dice;await g.onDiceRolled();}

test("explicit quarter-point budgets override the original dice, including zero, and async matches sync",async()=>{
  const session=createGameSession(fixture()),unit=session.thiefUnits[0];
  for(const points of [0,1,2,4,6,9]) {
    const options={session,turn:"THIEF",unit,diceValue:6,movementPoints:points};
    const actions=calculateReachableActions(options);
    for(const action of actions.values())assert.ok(action.costSpent<=points);
    if(points<4)assert.equal(actions.size,0);
    assert.deepEqual(await calculateReachableActionsAsync(options),actions);
  }
  for(const points of [-1,NaN,1.5,Infinity])assert.throws(()=>calculateReachableActions({session,turn:"THIEF",unit,movementPoints:points}),/Movement points/);
});

test("new maps use continuous rules; old encodings retain single actions and upgrade/expansion preserve their source",()=>{
  assert.equal(createNewMapDefinition().actionRules,"continuous");
  for(const old of [createRampMapDefinition(),createNewMapDefinition({actionRules:"single"})]) {
    const encodedMap=encodeMapDefinition(old),before=structuredClone(old);
    const upgraded=createActionUpgradeCopy({encodedMap,mapId:"old",name:"原图"});
    assert.deepEqual(old,before);assert.deepEqual(upgraded.terrain,old.terrain);
    assert.equal(upgraded.actionRules,"continuous");assert.equal(upgraded.actionUpgrade.source.encodedMap,encodedMap);
    assert.deepEqual(decodeMapDefinition(encodeMapDefinition(upgraded)),upgraded);
    assert.throws(()=>createActionUpgradeCopy({encodedMap:encodeMapDefinition(upgraded)}),/already/);
    if(old.meta.rows===10)assert.deepEqual(createMapExpansionDraft({encodedMap:encodeMapDefinition(upgraded)}).actionUpgrade,upgraded.actionUpgrade);
  }
  const encoded=encodeMapDefinition(fixture()),payload=JSON.parse(Buffer.from(encoded.slice(3),"base64url").toString());
  for(const q of [null,{source:{encodedMap:encoded}},{source:{encodedMap:"broken"}}])assert.throws(()=>decodeMapDefinition(`v5.${Buffer.from(JSON.stringify({...payload,q})).toString("base64url")}`));
});

test("moving, boarding, driving, collecting money and moving again spend one original budget without automatic operations",async()=>{
  await roll();const unit=g.thiefUnits[0];
  g.handleCellClick(8,8);g.cancelUnitSelection();g.handleCellClick(0,0);
  await g.moveSelectedUnit(0,1);assert.equal(unit.inCar,false);assert.equal(g.session.remainingPoints,12);assert.equal(g.session.actingUnitId,unit.id);
  g.handleCellClick(8,8);g.cancelUnitSelection();assert.equal(g.selectedUnit,unit);
  await g.performOperation("BOARD");assert.equal(unit.inCar,true);assert.equal(g.session.remainingPoints,8);
  await g.moveSelectedUnit(0,2);assert.equal(unit.hasMoney,false);assert.equal(g.session.remainingPoints,6);
  assert.match(els.remainingPoints.textContent,/剩余 1.5/);
  await g.performOperation("STEAL");assert.equal(unit.hasMoney,true);assert.equal(g.session.remainingPoints,2);
  g.performOperation("STEAL");assert.equal(g.session.remainingPoints,2,"duplicate operation cannot pay or execute again");
  await g.moveSelectedUnit(0,3);assert.equal(g.turn,"POLICE");assert.equal(g.diceValue,0);assert.equal(g.session.remainingPoints,null);
  assert.equal(unit.c,3);assert.equal(g.session.actingUnitId,null);g.dispose();
});

test("touch preview and cancellation do not spend points; double confirmation does not repeat a segment",async()=>{
  await roll();g.handleCellClick(0,0);g.handleCellClick(0,1,{previewOnly:true});
  assert.equal(g.session.remainingPoints,16);assert.equal(g.session.actingUnitId,null);
  assert.match(els.movePreviewText.textContent,/消耗 1 点，剩余 3 点/);
  g.cancelMovePreview();assert.equal(g.session.remainingPoints,16);
  g.handleCellClick(0,1,{previewOnly:true});await g.confirmMove();const revision=g.session.revision;
  g.confirmMove();assert.equal(g.session.revision,revision);assert.equal(g.session.remainingPoints,12);
  g.handleCellClick(0,2,{previewOnly:true});assert.match(els.movePreviewText.textContent,/消耗 1 点，剩余 2 点/);
  g.setBoardMode("isometric");assert.equal(g.session.remainingPoints,12);assert.deepEqual(g.pendingDestination,{r:0,c:2});
  g.setBoardMode("topdown");g.cancelMovePreview();
  assert.equal(g.selectedUnit,g.thiefUnits[0]);g.dispose();
});

test("action history retains segments and turn boundaries through view switches, and resets for a new game",async()=>{
  await roll();g.handleCellClick(0,0);await g.moveSelectedUnit(0,1);
  const first=els.lastAction.textContent;
  assert.equal(first.includes("刚才："),false);
  await g.performOperation("BOARD");
  assert.ok(els.lastAction.textContent.startsWith(first));
  assert.equal(els.lastAction.querySelectorAll(".action-turn").length,1);
  assert.equal(els.lastAction.querySelectorAll(".action-result-entry").length,2);
  g.endTurn();
  assert.equal(els.lastAction.querySelectorAll(".action-turn").length,1,"ending stays in the same turn group");
  assert.equal(els.lastAction.querySelectorAll(".action-result-entry").length,3);
  g.diceValue=2;await g.onDiceRolled();g.handleCellClick(9,9);await g.moveSelectedUnit(9,8);
  assert.equal(els.lastAction.querySelectorAll(".action-turn").length,2);
  const history=els.lastAction.textContent;
  assert.ok(history.startsWith(first));assert.match(history,/警察 1 到达/);
  g.setBoardMode("topdown");g.setBoardMode("isometric");
  assert.equal(els.lastAction.textContent,history);
  g.init(fixture());
  assert.equal(els.lastAction.querySelectorAll(".action-turn").length,0);
  assert.equal(els.lastAction.textContent,"行动结果会显示在这里。");g.dispose();
});

test("insufficient operation balance never takes money, and voluntarily ending discards only the remaining balance",async()=>{
  const map=fixture([[0,1,"ROAD"],[0,2,"ROAD"],[0,3,"BANK"]]);
  await roll(map,2);const unit=g.thiefUnits[0];unit.inCar=true;
  g.invalidateReachability();g.finishDiceSelection(g.getActiveUnitsForTurn());g.handleCellClick(0,0);
  await g.moveSelectedUnit(0,3);assert.equal(g.session.remainingPoints,2);
  assert.equal(g.operationsFor(unit).find(op=>op.type==="STEAL").enabled,false);
  g.performOperation("STEAL");assert.equal(unit.hasMoney,false);assert.equal(g.session.remainingPoints,2);
  g.endTurn();assert.equal(g.turn,"POLICE");assert.match(els.lastAction.textContent,/放弃 0.5 点/);
  g.endTurn();assert.equal(g.turn,"POLICE");g.dispose();
});

test("parking charges one operation point, preserves the vehicle and automatically ends an unusable fractional balance",async()=>{
  await roll(fixture(),2);const unit=g.thiefUnits[0];unit.inCar=true;
  g.session.parkingCars.clear();g.session.parkedCars.clear();g.invalidateReachability();g.finishDiceSelection(g.getActiveUnitsForTurn());
  g.handleCellClick(0,0);await g.moveSelectedUnit(0,1);
  assert.equal(unit.inCar,true);assert.equal(g.session.remainingPoints,6);
  await g.performOperation("PARK");assert.equal(unit.inCar,false);assert.ok(g.session.parkingCars.has("0,1"));
  assert.equal(g.turn,"POLICE");assert.match(els.lastAction.textContent,/剩余 0.5 点无法支付/);g.dispose();
});

test("police can capture, drive to station, pay separately to disembark and deliver, then capture again with the balance",async()=>{
  const map=createRampMapDefinition({actionRules:"continuous"});
  for(const[r,c,t]of [[1,0,"POLICE_SPAWN"],[1,1,"THIEF_SPAWN"],[1,3,"THIEF_SPAWN"],[1,2,"POLICE_STATION"],[2,0,"PARKING"]])setLegacyTileAt(map,r,c,t);
  await roll(map,6,"POLICE");const unit=g.policeUnits[0];unit.inCar=true;
  g.session.parkingCars.clear();g.session.parkedCars.clear();g.invalidateReachability();g.finishDiceSelection(g.getActiveUnitsForTurn());g.handleCellClick(1,0);
  await g.moveSelectedUnit(1,1);assert.equal(unit.state,"CARRYING");assert.equal(g.session.remainingPoints,22);
  await g.moveSelectedUnit(1,2);assert.equal(unit.state,"CARRYING");assert.equal(unit.inCar,true);
  g.performOperation("DELIVER");assert.equal(g.session.remainingPoints,20);
  await g.performOperation("PARK");assert.equal(unit.inCar,false);assert.equal(g.session.remainingPoints,16);assert.ok(g.session.parkingCars.has("2,0"));
  await g.performOperation("DELIVER");assert.equal(unit.state,"IDLE");assert.equal(g.thiefUnits[0].state,"JAILED");assert.equal(g.session.remainingPoints,12);
  await g.moveSelectedUnit(1,3);assert.equal(g.thiefUnits[1].state,"CARRIED");assert.equal(g.phase,GAME_PHASES.FINISHED);assert.equal(g.session.remainingPoints,8);g.dispose();
});

test("signals and animals advance once when a full police turn ends, never for each segment",async()=>{
  await roll(fixture(),4,"POLICE");
  g.session.animalUnits.push({id:"A1",r:5,c:5,emoji:"🐷",farmKey:"4,4",roundsOnBoard:0});
  g.handleCellClick(9,9);await g.moveSelectedUnit(9,8);await g.moveSelectedUnit(9,7);
  assert.equal(g.session.signalPhase,SIGNAL_PHASES.PEDESTRIAN_GREEN);assert.equal(g.animalUnits[0].roundsOnBoard,0);
  g.endTurn();assert.equal(g.session.signalPhase,SIGNAL_PHASES.PEDESTRIAN_RED);assert.equal(g.animalUnits[0].roundsOnBoard,1);
  g.endTurn();assert.equal(g.session.signalPhase,SIGNAL_PHASES.PEDESTRIAN_RED);g.dispose();
});

test("a stationary operation remains selectable without a reachable destination and is not mistaken for permanent immobility",async()=>{
  const map=createRampMapDefinition({actionRules:"continuous",terrain:Array.from({length:10},()=>Array(10).fill("BUILDING"))});
  setLegacyTileAt(map,0,0,"BANK");const session=createGameSession(map);
  const unit={id:"T1",r:0,c:0,state:"ACTIVE",inCar:false,hasMoney:false};session.thiefUnits.push(unit);
  assert.equal(calculateReachableActions({session,unit,turn:"THIEF",diceValue:2}).size,0);
  assert.equal(isPermanentStalemate(session),false);
  g.init(map);g.session.thiefUnits.push({...unit});g.diceValue=2;await g.onDiceRolled();g.handleCellClick(0,0);
  assert.equal(g.phase,GAME_PHASES.SELECT_DESTINATION);assert.ok(g.operationsFor(g.selectedUnit).some(op=>op.enabled));
  await g.performOperation("STEAL");assert.equal(g.thiefUnits[0].hasMoney,true);assert.equal(g.turn,"POLICE");
  g.diceValue=6;await g.onDiceRolled();
  assert.equal(g.phase,GAME_PHASES.NO_MOVES);
  assert.equal(els.btnSkipTurn.classList.contains("hidden"),false);
  assert.equal(els.btnEndTurn.classList.contains("hidden"),true,"no-moves uses skip turn instead of showing a duplicate end-turn button");
  g.endTurn();
  assert.equal(g.phase,GAME_PHASES.FINISHED,"ending when permanently immobile still resolves as a draw");
  assert.match(els.victoryTitle.textContent,/平局/);
  g.dispose();
});

test("budget and board changes invalidate cached reachability and ignore a superseded Worker result",async()=>{
  const original=g.createSearchJob;const jobs=[];
  g.createSearchJob=payload=>{let done;const job={payload,promise:new Promise(resolve=>{done=resolve;}),cancel(){},finish:results=>done(results)};jobs.push(job);return job;};
  try {
    g.init(fixture());g.diceValue=4;const first=g.onDiceRolled(),unit=g.thiefUnits[0];
    g.session.remainingPoints=4;g.session.revision++;const second=g.onDiceRolled();
    jobs[0].finish(new Map([[unit.id,new Map([["9,8",{}]])]]));await first;
    assert.equal(g.phase,GAME_PHASES.CALCULATING);assert.equal(g.reachabilityCache.size,0);
    const moves=calculateReachableActions({session:g.session,turn:"THIEF",unit,movementPoints:4});
    jobs[1].finish(new Map([[unit.id,moves]]));await second;assert.equal(g.calculateReachableForUnit(unit),moves);
    const before=g.calculateReachableForUnit(unit);g.session.revision++;assert.notEqual(g.calculateReachableForUnit(unit),before);
    const third=g.onDiceRolled();g.endTurn();jobs[2].finish(new Map([[unit.id,moves]]));await third;
    assert.equal(g.phase,GAME_PHASES.AWAIT_ROLL);assert.equal(g.turn,"POLICE");assert.equal(g.reachabilityCache.size,0);
  } finally {g.createSearchJob=original;g.dispose();}
});

test("the editor explicitly upgrades a copy and preserves its source through clear and undo",()=>{
  initEditor();state.mode="EDITOR";setMapDefinition(createRampMapDefinition());persistCurrentMap({forceNewMap:true,mapName:"保留原图"});renderEditorBoard();
  const id=getCurrentMapId(),original=structuredClone(getMapList().find(map=>map.id===id));
  createContinuousActionCopy();assert.notEqual(getCurrentMapId(),id);assert.equal(state.mapDefinition.actionRules,"continuous");
  const source=structuredClone(state.mapDefinition.actionUpgrade);clearMap();assert.deepEqual(state.mapDefinition.actionUpgrade,source);undoMap();assert.deepEqual(state.mapDefinition.actionUpgrade,source);
  assert.deepEqual(getMapList().find(map=>map.id===id),original);
});
