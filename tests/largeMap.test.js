import test from "node:test";
import assert from "node:assert/strict";
import { createNewMapDefinition, createEmptyMapDefinition, createRampMapDefinition, cloneMapDefinition, setLegacyTileAt, getTilePlacementPlan, positionToIndex, indexToPosition } from "../src/domain/map/mapModel.js";
import { getMapDimensions, isWithinMap } from "../src/domain/map/mapDimensions.js";
import { encodeMapDefinition, decodeMapDefinition, normalizeEncodedMap } from "../src/domain/map/mapCodec.js";
import { createMapExpansionDraft, completeMapExpansion } from "../src/domain/map/mapExpansion.js";
import { createMapUpgradeDraft, completeMapUpgrade } from "../src/domain/map/mapUpgrade.js";
import { validateMapDefinition } from "../src/domain/rules/mapValidation.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { calculateReachableActions, calculateReachableActionsAsync, hasReachableAction } from "../src/domain/rules/moveGenerator.js";
import { applyResolvedAction } from "../src/domain/rules/interactionResolver.js";
import { canAnimalOccupyCell, getFarmSpawnCandidates } from "../src/domain/rules/npcRules.js";
import { findNearestAvailableParking, placeVehicle } from "../src/domain/rules/vehiclePlacement.js";
import { areCellsConnected } from "../src/domain/map/bridgeTopology.js";
import { normalizeMapRecord } from "../src/storage/mapStore.js";
import { upsertMapRecordInList } from "../src/storage/mapRecords.js";
import { planMapImport } from "../src/storage/mapBackup.js";
import { resolveInitialMapLoad } from "../src/storage/mapLoadPlan.js";
import { createRampScenario } from "./helpers/rampScenario.js";
import { encodeLegacyMapDefinition } from "./helpers/legacyPayload.js";

const wrap = p => `v${p.v}.${Buffer.from(JSON.stringify(p)).toString("base64url")}`;
const payload = encoded => JSON.parse(Buffer.from(encoded.slice(3), "base64url").toString());
function playable(size = 20, legacy = false) {
  const map = size === 20 ? createNewMapDefinition() : legacy ? createEmptyMapDefinition() : createRampMapDefinition();
  const edge = size === 20 ? 16 : size - 1, top = size === 20 ? 3 : 0;
  for (const [r,c,t] of [[size-1, edge, "THIEF_SPAWN"], [0,top,"POLICE_SPAWN"], [size-1,edge-1,"BANK"], [size-2,edge,"THIEF_BASE"], [0,top+1,"POLICE_STATION"]]) setLegacyTileAt(map,r,c,t);
  return map;
}

test("new maps default to 20×20 while historical factories and saved maps retain 10×10", () => {
  const map = createNewMapDefinition();
  assert.deepEqual(getMapDimensions(map), { rows:20, cols:20 });
  assert.equal(map.terrain.flat().length,400);
  assert.equal(map.actionRules,"single");
  assert.deepEqual(getMapDimensions(createEmptyMapDefinition()),{rows:10,cols:10});
  assert.equal(resolveInitialMapLoad().mapDefinition.meta.rows,20);
  for (const old of [createEmptyMapDefinition(),createRampMapDefinition()]) {
    const loaded=resolveInitialMapLoad({savedEncodedMap:encodeMapDefinition(old)});
    assert.equal(loaded.mapDefinition.meta.rows,10);
    assert.equal(loaded.source,"storage");
  }
  for (const [rows,cols] of [[0,0],[30,30],[10,20],[null,null],[20.5,20.5]]) assert.throws(()=>createEmptyMapDefinition({meta:{rows,cols}}),/dimensions/);
  assert.throws(()=>cloneMapDefinition({terrain:Array.from({length:20},()=>Array(20).fill("ROAD"))}),/exceeds/);
});

test("20×20 model preserves far-edge terrain, spawns, facilities and mountain buffers without coordinate aliasing", () => {
  const map=createNewMapDefinition();
  for (const [r,c,t] of [[19,16,"BANK"],[16,0,"POLICE_SPAWN"],[0,16,"THIEF_SPAWN"],[10,10,"FARM"]]) setLegacyTileAt(map,r,c,t);
  map.features[0].config={cash:3};
  setLegacyTileAt(map,18,3,"MOUNTAIN");
  assert.equal(map.terrain[19][3],"GRASS");
  assert.equal(getTilePlacementPlan(map,19,3,"ROAD").canPlace,false);
  const copy=cloneMapDefinition(map);assert.deepEqual(copy,map);
  assert.equal(copy.features[0].position.r,19);
  assert.equal(positionToIndex({r:19,c:19},map),399);
  assert.deepEqual(indexToPosition(399,map),{r:19,c:19});
  assert.notEqual(positionToIndex({r:11,c:0},map),positionToIndex({r:10,c:10},map));
  for (const [r,c] of [[20,0],[-1,0],[0,20],[.5,4]]) {
    assert.equal(isWithinMap(map,r,c),false);
    const before=JSON.stringify(map);setLegacyTileAt(map,r,c,"GRASS");assert.equal(JSON.stringify(map),before);
  }
});

test("v5 explicitly round trips dimensions, separate action rules, all corners and stable ramp codes", () => {
  const map=playable();map.meta.name="二十格地图";
  map.terrain[11].splice(10,5,"MOUNTAIN","OVERPASS_RAMP_N","OVERPASS_RAMP_E","OVERPASS_RAMP_S","OVERPASS_RAMP_W");
  const encoded=encodeMapDefinition(map),p=payload(encoded);
  assert.ok(encoded.startsWith("v5."));assert.deepEqual(p.d,[20,20]);assert.equal(p.a,"single");assert.equal(p.t.length,400);
  assert.equal(p.t.slice(230,235),"KLMNO");
  assert.deepEqual(decodeMapDefinition(encoded),map);
  assert.equal(normalizeEncodedMap(encoded),encoded);
  for (const encodedOld of [encodeMapDefinition(playable(10)),encodeMapDefinition(playable(10,true)),encodeLegacyMapDefinition(playable(10,true))]) assert.equal(decodeMapDefinition(encodedOld).terrain.length,10);
});

test("invalid v5 dimensions, rules, lengths, indices and overlaps fail closed and retain their original record", () => {
  const good=payload(encodeMapDefinition(playable()));
  const broken=[{d:[null,null]},{d:[10,20]},{d:[40,40]},{d:undefined},{a:"continued"},{a:undefined},{b:"unknown"},{t:good.t.slice(1)},{p:[400]},{p:[-1]},{p:[399],h:[399]},{x:{status:"ready",offset:{r:5,c:5},source:{encodedMap:"broken"}}}];
  for (const change of broken) {
    const encoded=wrap({...good,...change});assert.throws(()=>decodeMapDefinition(encoded));
    const recovered=normalizeMapRecord({id:"bad",encodedMap:encoded});assert.equal(recovered.isCorrupt,true);assert.equal(recovered.encodedMap,encoded);
  }
  for (const v of [3,4]) assert.throws(()=>decodeMapDefinition(wrap({...payload(encodeMapDefinition(playable(10))),v,d:[20,20]})),/require v5/);
});

test("explicit expansion centers the original and preserves source, configurations and mountain buffers without editing the source", () => {
  const original=playable(10);setLegacyTileAt(original,9,4,"MOUNTAIN");original.features[0].config={value:8};
  const before=structuredClone(original),encodedMap=encodeMapDefinition(original);
  const draft=createMapExpansionDraft({encodedMap,mapId:"old",name:"旧图"});
  assert.deepEqual(original,before);assert.equal(draft.terrain[14][9],"MOUNTAIN");assert.equal(draft.terrain[15][9],"GRASS");assert.equal(draft.terrain[19][19],"VOID");
  assert.deepEqual(draft.features[0],{...original.features[0],position:{r:14,c:13}});
  assert.equal(draft.expansion.source.encodedMap,encodedMap);
  assert.equal(validateMapDefinition(draft).valid,false);assert.throws(()=>createGameSession(draft),/校验并完成扩展/);
  const result=completeMapExpansion(draft);assert.equal(result.valid,true);assert.equal(result.mapDefinition.expansion.status,"ready");
  assert.deepEqual(decodeMapDefinition(encodeMapDefinition(result.mapDefinition)),result.mapDefinition);
  assert.equal(createGameSession(result.mapDefinition).thiefUnits[0].r,14);
  assert.throws(()=>createMapExpansionDraft({encodedMap:encodeMapDefinition(playable())}),/10×10/);
});

test("bridge upgrade and expansion can be reviewed in either order without losing either source", () => {
  const original=playable(10,true),encodedMap=encodeMapDefinition(original);
  const expanded=createMapExpansionDraft({encodedMap});
  const upgraded=createMapUpgradeDraft({encodedMap:encodeMapDefinition(expanded)});
  const first=completeMapUpgrade(upgraded);assert.equal(first.valid,true);
  const ready=completeMapExpansion(first.mapDefinition);assert.equal(ready.valid,true);
  assert.deepEqual(decodeMapDefinition(encodeMapDefinition(ready.mapDefinition)),ready.mapDefinition);
  assert.equal(ready.mapDefinition.expansion.source.encodedMap,encodedMap);
  assert.equal(ready.mapDefinition.upgrade.source.encodedMap,encodeMapDefinition(expanded));
  const upgradeFirst=completeMapUpgrade(createMapUpgradeDraft({encodedMap}));
  const expansionSecond=completeMapExpansion(createMapExpansionDraft({encodedMap:encodeMapDefinition(upgradeFirst.mapDefinition)}));
  assert.equal(expansionSecond.valid,true);
  assert.deepEqual(decodeMapDefinition(encodeMapDefinition(expansionSecond.mapDefinition)),expansionSecond.mapDefinition);
  const invalid=createMapExpansionDraft({encodedMap:encodeMapDefinition(createRampMapDefinition())});assert.equal(completeMapExpansion(invalid).valid,false);
});

test("v5 saving and backup import preserve dimensions and source while keeping the original record intact", () => {
  const old={id:"old",name:"原图",encodedMap:encodeMapDefinition(playable(10)),updatedAt:1,schemaVersion:4};
  const draft=createMapExpansionDraft({encodedMap:old.encodedMap,mapId:old.id});
  const saved=upsertMapRecordInList({maps:[old],currentMapId:old.id,encodedMap:encodeMapDefinition(draft),createId:()=>"new"});
  assert.equal(saved.currentMapId,"new");assert.deepEqual(saved.maps[1],old);assert.equal(saved.currentMap.schemaVersion,5);
  const again=upsertMapRecordInList({maps:saved.maps,currentMapId:"new",encodedMap:saved.currentMap.encodedMap});assert.equal(again.maps.length,2);
  const imported=planMapImport(JSON.stringify({version:1,maps:saved.maps}),[],{createId:()=>"imported"});
  assert.equal(imported.imported,2);assert.equal(imported.maps[0].schemaVersion,5);
  assert.deepEqual(decodeMapDefinition(imported.maps[0].encodedMap),draft);
  assert.equal(planMapImport(JSON.stringify({version:1,maps:imported.maps}),imported.maps).duplicates,2);
});

test("far-edge road movement, money, capture and vehicle parking use the full 20×20 bounds", () => {
  const session=createGameSession(playable());const thief=session.thiefUnits[0];
  const action=calculateReachableActions({session,turn:"THIEF",unit:thief,diceValue:2}).get("19,15");
  assert.equal(action.hasMoney,true);applyResolvedAction({session,turn:"THIEF",unit:thief,action});assert.equal(thief.hasMoney,true);
  const officer=session.policeUnits[0];officer.r=18;officer.c=15;
  const capture=calculateReachableActions({session,turn:"POLICE",unit:officer,diceValue:1}).get("19,15");assert.equal(capture.type,"CAPTURE");
  applyResolvedAction({session,turn:"POLICE",unit:officer,action:capture});assert.equal(thief.state,"CARRIED");
  setLegacyTileAt(session.mapDefinition,19,14,"PARKING");
  assert.deepEqual(findNearestAvailableParking(session,{r:19,c:15}),{r:19,c:14});
  assert.deepEqual(placeVehicle(session,{origin:{r:19,c:15},preferredPosition:{r:20,c:18}}).position,{r:19,c:14});
});

test("all four ramps beyond the old boundary preserve bridge costs, bank paths, side closures and unique visited cells", () => {
  for (const direction of ["N","E","S","W"]) {
    const fixture=createRampScenario(direction);
    const map=createNewMapDefinition();
    for (let r=0;r<10;r++) for(let c=0;c<10;c++) map.terrain[r+8][c+8]=fixture.map.terrain[r][c];
    map.features=fixture.map.features.map(f=>({...f,position:{r:f.position.r+8,c:f.position.c+8}}));
    for(const side of ["police","thief"]) map.spawns[side]=fixture.map.spawns[side].map(p=>({r:p.r+8,c:p.c+8}));
    assert.equal(validateMapDefinition(map).valid,true);
    const session=createGameSession(map),unit=session.thiefUnits[0];unit.inCar=true;
    const end={r:fixture.positions.end.r+8,c:fixture.positions.end.c+8};
    const action=calculateReachableActions({session,turn:"THIEF",unit,diceValue:2}).get(`${end.r},${end.c}`);
    assert.equal(action.hasMoney,true);assert.equal(action.costSpent,5);
    assert.equal(new Set(action.path.map(p=>`${p.r},${p.c}`)).size,action.path.length);
    assert.equal(areCellsConnected(map,{r:12,c:12},{r:fixture.positions.side.r+8,c:fixture.positions.side.c+8}),false);
  }
});

test("farm spawning and occupancy reach row and column 20 but reject off-board neighbors", () => {
  const map=createNewMapDefinition();setLegacyTileAt(map,19,16,"FARM");const session=createGameSession(map);
  const candidates=getFarmSpawnCandidates(session,{r:19,c:16});
  assert.deepEqual(candidates,[{r:18,c:16},{r:19,c:15}]);
  assert.equal(canAnimalOccupyCell(session,19,15),true);assert.equal(canAnimalOccupyCell(session,20,18),false);
});

test("cooperative fallback yields, matches the exact synchronous search and can be cancelled", async () => {
  const session=createGameSession(playable());const unit=session.thiefUnits[0];unit.inCar=true;
  const options={session,turn:"THIEF",unit,diceValue:6};let pauses=0;
  const result=await calculateReachableActionsAsync(options,{pause:async()=>{pauses++;}});
  assert.deepEqual(result,calculateReachableActions(options));assert.ok(pauses>0);
  let cancelled=false;
  assert.equal(await calculateReachableActionsAsync(options,{pause:async()=>{cancelled=true;},cancelled:()=>cancelled}),null);
});


test("large-map stalemate checks need only one actual legal action and retain low-roll and trapped distinctions", async () => {
  const { isPermanentStalemate } = await import("../src/domain/rules/stalemateResolver.js");
  const map=createNewMapDefinition();map.terrain=Array.from({length:20},()=>Array(20).fill("BUILDING"));
  setLegacyTileAt(map,19,16,"THIEF_SPAWN");setLegacyTileAt(map,19,15,"GRASS");
  const session=createGameSession(map),unit=session.thiefUnits[0];
  assert.equal(hasReachableAction({session,turn:"THIEF",unit,diceValue:1}),false);
  assert.equal(hasReachableAction({session,turn:"THIEF",unit,diceValue:6}),true);
  assert.equal(isPermanentStalemate(session),false);
  map.terrain[19][15]="MOUNTAIN";session.mapDefinition.terrain[19][15]="MOUNTAIN";
  session.mapDefinition.terrain[18][16]="MOUNTAIN";
  assert.equal(isPermanentStalemate(session),true);
});
