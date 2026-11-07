import test from "node:test";
import assert from "node:assert/strict";
import { createExampleMap } from "../src/domain/map/exampleMap.js";
import { isWithinMap } from "../src/domain/map/mapDimensions.js";
import { getFeaturePositionsByKind } from "../src/domain/map/mapQueries.js";
import { getBridgeWarnings, getRampConnectionIssues } from "../src/domain/map/bridgeTopology.js";
import { validateMapDefinition, getPotentialRoutes } from "../src/domain/rules/mapValidation.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { calculateReachableActions } from "../src/domain/rules/moveGenerator.js";
import { applyResolvedAction } from "../src/domain/rules/interactionResolver.js";
import { getFarmSpawnCandidates } from "../src/domain/rules/npcRules.js";

function reachable(session, unit, turn = "THIEF", diceValue = 1) {
  return calculateReachableActions({ session, unit, turn, diceValue });
}

test("the 376-cell example has two police, two thieves, six cars and valid routes, scenery buffers and farm exits", () => {
  const map=createExampleMap(),session=createGameSession(map);
  assert.deepEqual(validateMapDefinition(map),{valid:true,errors:[]});
  assert.deepEqual(getRampConnectionIssues(map),[]);assert.deepEqual(getBridgeWarnings(map),[]);
  assert.equal(map.terrain.flat().filter(t=>t!=="VOID").length,376);
  assert.equal(session.policeUnits.length,2);assert.equal(session.thiefUnits.length,2);assert.equal(session.parkingCars.size,6);
  for (const officer of session.policeUnits) {
    const route=getPotentialRoutes(map,officer,"POLICE");
    assert.equal(route.canDeliver,true);
    for(const station of getFeaturePositionsByKind(map,"POLICE_STATION"))assert.ok(route.positions.has(`${station.r},${station.c}`));
  }
  for(const farm of getFeaturePositionsByKind(map,"FARM"))assert.ok(getFarmSpawnCandidates(session,farm).length>=2);
  for(let r=0;r<20;r++)for(let c=0;c<20;c++)if(map.terrain[r][c]==="MOUNTAIN") {
    for(const[dr,dc]of [[-1,0],[1,0],[0,-1],[0,1]])if(isWithinMap(map,r+dr,c+dc))assert.ok(["GRASS","MOUNTAIN"].includes(map.terrain[r+dr][c+dc]));
  }
});

test("each of the four starting characters can actually board a nearby available vehicle with one step",()=>{
  const session=createGameSession(createExampleMap());
  for(const[unit,turn,key]of [[session.thiefUnits[0],"THIEF","16,5"],[session.thiefUnits[1],"THIEF","3,16"],
    [session.policeUnits[0],"POLICE","6,6"],[session.policeUnits[1],"POLICE","15,16"]]) {
    const action=reachable(session,unit,turn).get(key);
    assert.equal(action?.type,"BOARD");assert.equal(action.costSpent,4);
    applyResolvedAction({session,turn,unit,action});assert.equal(unit.inCar,true);assert.equal(session.parkingCars.has(key),false);
  }
  assert.equal(session.parkingCars.size,2);
});

test("the example elevated junction serves all four ramps, while the ford is an actual vehicle-only water route",()=>{
  const session=createGameSession(createExampleMap()),unit=session.thiefUnits[0];
  Object.assign(unit,{r:9,c:5,inCar:true});
  const options=reachable(session,unit,"THIEF",3);
  const across=options.get("9,14");assert.ok(across);assert.equal(across.costSpent,10);
  assert.ok(across.path.some(p=>session.mapDefinition.terrain[p.r][p.c]==="OVERPASS_RAMP_E"));
  assert.ok(across.path.some(p=>session.mapDefinition.terrain[p.r][p.c]==="OVERPASS_RAMP_W"));
  for(const[r,c,ramp]of [[5,12,"OVERPASS_RAMP_S"],[13,12,"OVERPASS_RAMP_N"]])assert.ok(options.get(`${r},${c}`)?.path.some(p=>session.mapDefinition.terrain[p.r][p.c]===ramp));
  Object.assign(unit,{r:9,c:7});const deck=reachable(session,unit);
  assert.equal(deck.has("8,7"),false);assert.equal(deck.has("10,7"),false);
  Object.assign(unit,{r:13,c:8});const ford=reachable(session,unit,"THIEF",5).get("13,12");
  assert.ok(ford);assert.equal(ford.costSpent,20);assert.deepEqual(ford.path,[{r:13,c:8},{r:13,c:9},{r:13,c:10},{r:13,c:11},{r:13,c:12}]);
  unit.inCar=false;assert.equal(reachable(session,unit,"THIEF",6).has("13,9"),false);
});

test("example manholes transfer walking thieves and both banks have real escape routes",()=>{
  for(const[bank,base]of [[{r:6,c:4},{r:3,c:4}],[{r:12,c:15},{r:16,c:15}]]) {
    const session=createGameSession(createExampleMap()),unit=session.thiefUnits[0];
    Object.assign(unit,{r:15,c:3});
    const jump=reachable(session,unit).get("6,5");assert.equal(jump?.movementKind,"TELEPORT");assert.equal(jump.costSpent,4);
    unit.inCar=true;assert.equal(reachable(session,unit).has("6,5"),false);unit.inCar=false;
    Object.assign(session.policeUnits[0],{r:15,c:3});assert.equal(reachable(session,session.policeUnits[0],"POLICE").has("6,5"),false);
    // Start beside each bank to check the actual money/escape resolver, not only optimistic validation.
    Object.assign(unit,{r:bank.r,c:bank.c-1});
    const money=reachable(session,unit).get(`${bank.r},${bank.c}`);assert.ok(money);
    applyResolvedAction({session,turn:"THIEF",unit,action:money});assert.equal(unit.hasMoney,true);
    const escape=reachable(session,unit,"THIEF",6).get(`${base.r},${base.c}`);assert.equal(escape?.type,"ESCAPE");
    applyResolvedAction({session,turn:"THIEF",unit,action:escape});assert.equal(unit.state,"ESCAPED");
  }
});
