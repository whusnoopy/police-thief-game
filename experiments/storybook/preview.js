import { createEmptyMapDefinition, setLegacyTileAt, getTilePlacementPlan } from "../../src/domain/map/mapModel.js";
import { getCellDisplayAt } from "../../src/domain/map/cellDisplay.js";
import { getCellRuleAt } from "../../src/domain/rules/cellRules.js";
import { createGameSession } from "../../src/domain/game/sessionFactory.js";
import { calculateReachableActions } from "../../src/domain/rules/moveGenerator.js";
import { getAllowedCrosswalkAxis, isCrosswalkTileType } from "../../src/domain/map/crosswalk.js";
import { TILE_TYPES, SIGNAL_PHASES } from "../../src/config/constants.js";
import { ASSETS, terrainArt, addImage, addFeature, addUnit, iconSvg } from "./visuals.js";

const board=document.querySelector("#board"), feedback=document.querySelector("#feedback");
let look="art",brush="inspect",selected={r:3,c:3},pathKey=null,green=true;
function createExample() {
  const map=createEmptyMapDefinition({terrain:Array.from({length:10},()=>Array(10).fill("GRASS"))});
  for(let i=0;i<10;i++) {
    setLegacyTileAt(map,2,i,"ROAD");setLegacyTileAt(map,7,i,"ROAD");
    setLegacyTileAt(map,i,2,"ROAD");setLegacyTileAt(map,i,6,"ROAD");
    setLegacyTileAt(map,i,i<5?8:9,"RIVER");
  }
  [[0,9],[1,9],[3,9],[4,9],[5,8],[6,8]].forEach(([r,c])=>setLegacyTileAt(map,r,c,"RIVER"));
  [[3,3],[3,4],[4,3]].forEach(([r,c])=>setLegacyTileAt(map,r,c,"ROAD"));
  [[3,3,"BANK"],[1,2,"POLICE_SPAWN"],[7,4,"THIEF_SPAWN"],[8,6,"THIEF_BASE"],
   [6,2,"PARKING"],[2,5,"MANHOLE"],[1,1,"POLICE_STATION"],[8,3,"FARM"],
   [1,4,"BUILDING"],[4,0,"CONSTRUCTION_SITE"],[5,4,"BARRIER"],[8,0,"MOUNTAIN"],
   [0,4,"OVERPASS"],[0,5,"OVERPASS"],[0,6,"OVERPASS"],
   [2,4,"CROSSWALK_HORIZONTAL"],[6,6,"CROSSWALK_VERTICAL"],[0,0,"TRAFFIC_LIGHT"]
  ].forEach(([r,c,type])=>setLegacyTileAt(map,r,c,type));
  return map;
}
let map=createExample();
function scene() {
  const session=createGameSession(map);
  session.signalPhase=green?SIGNAL_PHASES.PEDESTRIAN_GREEN:SIGNAL_PHASES.PEDESTRIAN_RED;
  const policeState=document.querySelector("#police-state").value;
  const thiefState=document.querySelector("#thief-state").value;
  session.policeUnits[0].inCar=policeState.includes("car");
  session.policeUnits[0].state=policeState.includes("escort")?"CARRYING":"IDLE";
  session.thiefUnits[0].inCar=thiefState.includes("car");
  session.thiefUnits[0].hasMoney=thiefState.includes("money");
  if(document.querySelector("#bank-occupant").checked) Object.assign(session.thiefUnits[0],{r:3,c:3,hasMoney:true});
  // T2 exists only in the escort illustration; T1 remains the active thief.
  if(policeState.includes("escort")) session.thiefUnits.push({id:"T2",r:1,c:2,state:"CARRIED",inCar:false,hasMoney:false,carrierId:"P1"});
  session.animalUnits=[{id:"A1",r:9,c:3,emoji:"🐷",art:"pig"},{id:"A2",r:8,c:4,emoji:"🐮",art:"cow"}];
  return session;
}
function showCell(r,c,session=scene()) {
  selected={r,c};
  const display=getCellDisplayAt(map,r,c),rules=getCellRuleAt(map,r,c);
  document.querySelector("#cell-position").textContent=`第 ${r+1} 行 · 第 ${c+1} 列`;
  document.querySelector("#cell-name").textContent=TILE_TYPES[display.tileType].name;
  const walk=rules.walkCost===null?"步行不可进入":`步行 ${rules.walkCost/4} 步`;
  const car=rules.driveCost===null?"车辆不可进入":`车辆 ${rules.driveCost/4} 步`;
  let extra=display.tileType==="BANK"?"小偷到达后拿到钱。":display.tileType==="THIEF_BASE"?"仅小偷可进入，携款到达后逃脱。":display.tileType==="POLICE_STATION"?"仅警察可进入，押送到达后恢复抓捕。":"";
  if(isCrosswalkTileType(display.tileType)) {
    const axis=getAllowedCrosswalkAxis(display.tileType,!green,session.signalPhase);
    extra=`当前${green?"行人":"车辆"}可${axis==="HORIZONTAL"?"左右":"上下"}通过，${green?"车辆":"行人"}等待。`;
  }
  if(session.animalUnits.some(a=>a.r===r&&a.c===c)) extra+="当前有动物占位，不可进入。";
  document.querySelector("#cell-rule").textContent=`${walk}；${car}。${extra}`;
  return `第 ${r+1} 行 ${c+1} 列 · ${TILE_TYPES[display.tileType].name}：${walk}；${car}。${extra}`;
}
function render() {
  const session=scene();
  const moves=document.querySelector("#show-moves").checked?calculateReachableActions({session,turn:"THIEF",diceValue:4,unit:session.thiefUnits[0]}):new Map();
  const action=pathKey?moves.get(pathKey):null;
  const steps=new Map();let spent=0;
  action?.trail.forEach(segment=>{spent+=segment.cost;steps.set(`${segment.r},${segment.c}`,segment.movementKind==="BOARD"?"上车":segment.movementKind==="PARK"?"下车":String(spent/4));});
  board.className=`${look} ${document.querySelector("#show-grid").checked?"with-grid":""}`;
  board.innerHTML=look==="art"?terrainArt(map):"";
  document.querySelector("#signal").textContent=green?"行人绿灯 · 点击切换":"行人红灯 · 点击切换";
  document.querySelector("#signal").setAttribute("aria-pressed",String(!green));
  for(let r=0;r<10;r++) for(let c=0;c<10;c++) {
    const key=`${r},${c}`,display=getCellDisplayAt(map,r,c),cell=document.createElement("button");
    cell.type="button";cell.className="map-cell";cell.dataset.terrain=display.terrain;
    cell.dataset.feature=display.feature?.kind||"";cell.dataset.coord=key;
    let accessible=`第 ${r+1} 行 ${c+1} 列，${TILE_TYPES[display.tileType].name}`;
    if(look==="emoji") cell.textContent=display.markerEmoji;else addFeature(cell,display,green);
    const police=session.policeUnits.find(u=>u.r===r&&u.c===c);
    const thief=session.thiefUnits.find(u=>u.state==="ACTIVE"&&u.r===r&&u.c===c);
    const animal=session.animalUnits.find(u=>u.r===r&&u.c===c);
    if(police) {addUnit(cell,{...police,role:"police",carrying:police.state==="CARRYING"},look);accessible+=`，${police.id}${police.inCar?"驾车":"步行"}${police.state==="CARRYING"?"，押送 T2":""}`;}
    if(thief) {addUnit(cell,{...thief,role:"thief"},look);accessible+=`，${thief.id}${thief.inCar?"驾车":"步行"}${thief.hasMoney?"，携款":""}`;}
    if(animal) {addUnit(cell,{role:animal.art,id:animal.id},look);accessible+=`，${animal.art==="pig"?"猪":"牛"}占位`;}
    if(session.parkedCars.has(key)) {
      if(look==="art") addImage(cell,"car","parked-art");else {const car=document.createElement("span");car.textContent="🚗";cell.appendChild(car);}
      accessible+="，有空车";
    }
    if(moves.has(key)) {const dot=document.createElement("span");dot.className="move-dot";dot.setAttribute("aria-hidden","true");cell.appendChild(dot);accessible+="，小偷可达";}
    if(steps.has(key)) {cell.classList.add("path-cell");const badge=document.createElement("span");badge.className="path-step";badge.textContent=steps.get(key);cell.appendChild(badge);}
    cell.setAttribute("aria-label",accessible);
    cell.addEventListener("click",()=>{
      if(brush!=="inspect") {
        if(display.feature||display.spawnSide||police||thief||animal) {feedback.textContent="这格放着地标或角色，请选择旁边的空格试画。";return;}
        if(!getTilePlacementPlan(map,r,c,brush).canPlace) {feedback.textContent="山周围必须保留草地，不能在这里更改地形。";return;}
        selected={r,c};pathKey=null;setLegacyTileAt(map,r,c,brush);render();
        feedback.textContent=`已画上${TILE_TYPES[brush].name}，相邻边缘已更新。`;
      } else {const description=showCell(r,c,session);pathKey=moves.has(key)?key:null;render();feedback.textContent=description+(pathKey?" 已显示到此处的路线与累计步数。":"");}
      board.querySelector(`[data-coord="${key}"]`).focus({preventScroll:true});
    });board.appendChild(cell);
  }
  showCell(selected.r,selected.c,session);
}
function renderCatalogue() {
  ASSETS.forEach(([key,name])=>{
    const card=document.createElement("article");card.className="asset-card";
    const art=document.createElement("div");art.className="catalogue-art";addImage(art,key);
    const label=document.createElement("div");label.innerHTML=`<strong>${name}</strong><span>${key}.png</span>`;
    card.append(art,label);document.querySelector("#asset-catalogue").appendChild(card);
  });
  const examples=[
    ["步行携款",{role:"thief",id:"T1",hasMoney:true}],
    ["驾车携款",{role:"thief",id:"T1",hasMoney:true,inCar:true}],
    ["步行押送",{role:"police",id:"P1",carrying:true}],
    ["驾车押送",{role:"police",id:"P1",carrying:true,inCar:true}],
    ["银行有人",{role:"thief",id:"T1",hasMoney:true}],
  ];
  examples.forEach(([label,unit],i)=>{
    const card=document.createElement("figure"),cell=document.createElement("div");cell.className="map-cell state-example";
    if(i===4) addFeature(cell,{tileType:"BANK",feature:{kind:"BANK"}});
    addUnit(cell,unit);const caption=document.createElement("figcaption");caption.textContent=label;
    card.append(cell,caption);document.querySelector("#state-examples").appendChild(card);
  });
  document.querySelector("#state-legend").innerHTML=`<span>${iconSvg("money")} 携款</span><span>${iconSvg("escort")} 押送</span><span>P / T 出生点</span><span>数字：累计步数</span>`;
}
document.querySelectorAll("[data-look]").forEach(button=>button.addEventListener("click",()=>{
  look=button.dataset.look;document.querySelectorAll("[data-look]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));
  document.querySelector("#mode-caption").textContent=look==="art"?"绘本素材":"现有符号（同一地图）";render();
}));
document.querySelectorAll("[data-brush]").forEach(button=>button.addEventListener("click",()=>{
  brush=button.dataset.brush;document.querySelectorAll("[data-brush]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));
  feedback.textContent=brush==="inspect"?"点击地块查看规则和路线。":`点击空格画${TILE_TYPES[brush].name}。`;
}));
["show-grid","show-moves","police-state","thief-state","bank-occupant"].forEach(id=>document.getElementById(id).addEventListener("change",()=>{pathKey=null;render();}));
document.querySelector("#signal").addEventListener("click",()=>{green=!green;pathKey=null;render();feedback.textContent=green?"行人绿灯，车辆在斑马线处等待。":"行人红灯，车辆按斑马线对应方向通行。";});
document.querySelector("#reset").addEventListener("click",()=>{map=createExample();pathKey=null;render();feedback.textContent="已恢复河湾小镇示例。";});
renderCatalogue();render();
