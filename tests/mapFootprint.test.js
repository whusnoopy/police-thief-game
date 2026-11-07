import test from "node:test";
import assert from "node:assert/strict";
import { createNewMapDefinition, createRampMapDefinition, cloneMapDefinition, setLegacyTileAt, getTilePlacementPlan } from "../src/domain/map/mapModel.js";
import { isWithinMap } from "../src/domain/map/mapDimensions.js";
import { encodeMapDefinition, decodeMapDefinition } from "../src/domain/map/mapCodec.js";
import { getTerrainAt, getFeaturePositionsByKind } from "../src/domain/map/mapQueries.js";
import { getRampConnectionIssues, areCellsConnected } from "../src/domain/map/bridgeTopology.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { calculateReachableActions } from "../src/domain/rules/moveGenerator.js";
import { getPotentialRoutes, validateMapDefinition } from "../src/domain/rules/mapValidation.js";
import { canAnimalOccupyCell } from "../src/domain/rules/npcRules.js";
import { placeVehicle } from "../src/domain/rules/vehiclePlacement.js";
import { createIsometricScene } from "../src/ui/isometric/sceneModel.js";
import { createIsometricProjection, pickSurface, projectPoint, unprojectPoint } from "../src/ui/isometric/projection.js";
import { terrainArt } from "../src/ui/board/terrainArt.js";

const corners = [[0,0],[0,19],[19,0],[19,19]];
const wrap = p => `v5.${Buffer.from(JSON.stringify(p)).toString("base64url")}`;

test("each 20×20 corner loses exactly three layers; painting and mountain buffers honor the remaining 376 cells",()=>{
  const map=createNewMapDefinition();
  assert.equal(map.terrain.flat().filter(t=>t==="VOID").length,24);
  for(const [r,c] of corners) {
    const dr=r===0?1:-1,dc=c===0?1:-1;
    for(let a=0;a<4;a++) for(let b=0;b<4;b++) {
      const rr=r+a*dr,cc=c+b*dc;
      assert.equal(isWithinMap(map,rr,cc),a+b>=3);
      if(a+b<3) {
        for(const type of ["ROAD","BANK","POLICE_SPAWN","MOUNTAIN","OVERPASS_RAMP_N"]) {
          assert.equal(getTilePlacementPlan(map,rr,cc,type).canPlace,false);
          setLegacyTileAt(map,rr,cc,type);assert.equal(map.terrain[rr][cc],"VOID");
        }
      }
    }
  }
  setLegacyTileAt(map,1,2,"MOUNTAIN");
  assert.equal(map.terrain[0][2],"VOID");assert.equal(map.terrain[1][1],"VOID");
  assert.equal(map.terrain[1][3],"GRASS");assert.equal(map.terrain[2][2],"GRASS");
  assert.equal(cloneMapDefinition(map).terrain[0][0],"VOID");
  const old=createRampMapDefinition();for(const [r,c] of [[0,0],[0,9],[9,0],[9,9]])assert.equal(isWithinMap(old,r,c),true);
});

test("v5 persists the cut3 footprint and rejects mismatched terrain, corner occupants and unmarked shapes",()=>{
  const map=createNewMapDefinition(),encoded=encodeMapDefinition(map),p=JSON.parse(Buffer.from(encoded.slice(3),"base64url").toString());
  assert.equal(p.s,"cut3");assert.equal(p.t.length,400);assert.equal(p.t[0],"P");
  assert.deepEqual(decodeMapDefinition(encoded),map);
  for(const change of [{s:undefined},{s:"square"},{s:"cut2"},{p:[0]},{h:[399]},{f:[[5,19,{},"bad"]]},
    {t:"E"+p.t.slice(1)},{t:p.t.slice(0,210)+"P"+p.t.slice(211)}])assert.throws(()=>decodeMapDefinition(wrap({...p,...change})));
  const old=createRampMapDefinition({actionRules:"single"}),oldCode=encodeMapDefinition(old);
  assert.equal(JSON.parse(Buffer.from(oldCode.slice(3),"base64url").toString()).s,"square");
  assert.deepEqual(decodeMapDefinition(oldCode),old);
});

test("walking, driving, teleporting, validation, animals and parking cannot use a cut corner even with stray raw data",()=>{
  for(const ruleset of ["ramps","legacy"]) {
    const map=createNewMapDefinition();map.ruleset=ruleset;
    setLegacyTileAt(map,0,3,"THIEF_SPAWN");setLegacyTileAt(map,0,4,"BANK");setLegacyTileAt(map,1,3,"THIEF_BASE");
    const session=createGameSession(map),unit=session.thiefUnits[0];
    // A stray raw feature or terrain value must not turn missing cells into land.
    session.mapDefinition.terrain[0][2]="ROAD";
    session.mapDefinition.features.push({id:"outside",kind:"PARKING",position:{r:0,c:2},config:{}});
    assert.equal(getTerrainAt(session.mapDefinition,0,2),"VOID");
    assert.deepEqual(getFeaturePositionsByKind(session.mapDefinition,"PARKING"),[]);
    assert.equal(canAnimalOccupyCell(session,0,2),false);
    assert.equal(placeVehicle(session,{origin:{r:0,c:3},preferredPosition:{r:0,c:2}}).status,"PENDING");
    assert.equal(validateMapDefinition(session.mapDefinition).valid,false);
    for(const driving of [false,true]) {
      unit.inCar=driving;
      const actions=calculateReachableActions({session,turn:"THIEF",unit,diceValue:6});
      for(const action of actions.values())for(const step of action.path)assert.ok(isWithinMap(map,step.r,step.c));
      assert.equal(actions.has("0,2"),false);
    }
    session.mapDefinition.features.push({id:"inside",kind:"MANHOLE",position:{r:0,c:3},config:{}});
    session.mapDefinition.features.find(f=>f.id==="outside").kind="MANHOLE";
    session.mapDefinition.spawns.thief=[];unit.inCar=false;
    const actions=calculateReachableActions({session,turn:"THIEF",unit,diceValue:6});assert.equal(actions.has("0,2"),false);
    assert.equal(getPotentialRoutes(session.mapDefinition,unit,"THIEF").positions.has("0,2"),false);
    assert.equal(getPotentialRoutes(map,{r:0,c:0},"THIEF").positions.size,0);
  }
});

test("ramps cannot connect their high or low end into removed cells",()=>{
  const map=createNewMapDefinition();setLegacyTileAt(map,0,3,"OVERPASS_RAMP_W");
  assert.equal(areCellsConnected(map,{r:0,c:3},{r:0,c:2}),false);
  assert.ok(getRampConnectionIssues(map).some(i=>i.r===0&&i.c===3&&i.reason==="RAMP_HIGH_END"));
  setLegacyTileAt(map,0,3,"OVERPASS_RAMP_E");setLegacyTileAt(map,0,4,"OVERPASS");
  assert.deepEqual(getRampConnectionIssues(map).map(i=>i.reason),["RAMP_LOW_END"]);
});

test("the cropped scene draws and picks all 376 cells with correct actor coordinates and no invisible corner targets",()=>{
  const map=createNewMapDefinition();setLegacyTileAt(map,19,16,"THIEF_SPAWN");setLegacyTileAt(map,0,3,"POLICE_SPAWN");
  const projection=createIsometricProjection({rows:20,cols:20}),session=createGameSession(map),scene=createIsometricScene(session,projection);
  assert.equal(scene.cells.length,376);
  assert.deepEqual(scene.objects.filter(o=>o.kind==="unit").map(o=>[o.unit.id,o.r,o.c]),[["P1",0,3],["T1",19,16]]);
  const points=scene.cells.flatMap(c=>c.polygon),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  assert.equal(Math.max(...xs)-Math.min(...xs),1360);assert.equal(Math.max(...ys)-Math.min(...ys),680);
  assert.equal(Math.min(...xs),48);assert.equal(Math.min(...ys),100);
  for(const cell of scene.cells)assert.equal(pickSurface(cell.anchor,scene.cells),cell);
  for(const [r,c]of corners)assert.equal(pickSurface(projectPoint({r,c},projection),scene.cells),null);
  const point=projectPoint({r:19,c:16},projection);assert.deepEqual(unprojectPoint(point,projection),{r:19,c:16});
  const svg=terrainArt(map);assert.equal((svg.match(/fill="#b9cea0"/g)||[]).length,376);
  assert.ok(!svg.includes('data-tile="0,0"'));assert.ok(svg.includes('data-tile="0,3"'));
});
