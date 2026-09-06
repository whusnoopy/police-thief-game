import { createEmptyMapDefinition, setLegacyTileAt } from "../../src/domain/map/mapModel.js";
import { getCellDisplayAt } from "../../src/domain/map/cellDisplay.js";
import { getCellRuleAt } from "../../src/domain/rules/cellRules.js";
import { createGameSession } from "../../src/domain/game/sessionFactory.js";
import { calculateReachableActions } from "../../src/domain/rules/moveGenerator.js";
import { TILE_TYPES } from "../../src/config/constants.js";

const board = document.querySelector("#board");
const feedback = document.querySelector("#feedback");
let look = "art";
let brush = "inspect";
let selected = { r: 3, c: 3 };

function createExample() {
  const map = createEmptyMapDefinition({ terrain: Array.from({ length: 10 }, () => Array(10).fill("GRASS")) });
  for (let i = 0; i < 10; i++) {
    setLegacyTileAt(map, 2, i, "ROAD");
    setLegacyTileAt(map, 7, i, "ROAD");
    setLegacyTileAt(map, i, 2, "ROAD");
    setLegacyTileAt(map, i, 6, "ROAD");
    setLegacyTileAt(map, i, i < 5 ? 8 : 9, "RIVER");
  }
  [[0,9],[1,9],[3,9],[4,9],[5,8],[6,8]].forEach(([r,c]) => setLegacyTileAt(map,r,c,"RIVER"));
  [[3,3],[3,4],[4,3],[4,4]].forEach(([r,c]) => setLegacyTileAt(map,r,c,"ROAD"));
  setLegacyTileAt(map,3,3,"BANK");
  setLegacyTileAt(map,1,2,"POLICE_SPAWN");
  setLegacyTileAt(map,7,4,"THIEF_SPAWN");
  setLegacyTileAt(map,8,6,"THIEF_BASE");
  setLegacyTileAt(map,6,2,"PARKING");
  setLegacyTileAt(map,2,5,"MANHOLE");
  return map;
}

let map = createExample();
const at = (r,c) => map.terrain[r]?.[c];

// Preview only: shared edges join without gaps. A corner rounds inward only
// when both cardinal neighbors are absent; diagonal contact never opens a path.
function tilePath(r,c,type) {
  const n=at(r-1,c)===type, e=at(r,c+1)===type, s=at(r+1,c)===type, w=at(r,c-1)===type;
  const tl=!n&&!w?17:0, tr=!n&&!e?17:0, br=!s&&!e?17:0, bl=!s&&!w?17:0;
  return `M ${tl} 0 H ${100-tr} Q 100 0 100 ${tr} V ${100-br} Q 100 100 ${100-br} 100 H ${bl} Q 0 100 0 ${100-bl} V ${tl} Q 0 0 ${tl} 0 Z`;
}

function terrainArt() {
  let content = '<rect width="1000" height="1000" fill="#b9cea0"/>';
  for (let r=0;r<10;r++) for (let c=0;c<10;c++) {
    const type=at(r,c), x=c*100, y=r*100;
    if(type==="GRASS") {
      // Fixed coordinate-based details: repainting never makes grass jump.
      const shift=(r*17+c*23)%35;
      content+=`<g transform="translate(${x+15+shift} ${y+24+shift/2})" stroke="#93af81" fill="none" stroke-width="2" opacity=".45"><path d="M0 6 l-3 -7 M0 6 l4 -9 M0 6 l8 -3"/></g>`;
      continue;
    }
    content+=`<path transform="translate(${x} ${y})" d="${tilePath(r,c,type)}" fill="${type==="RIVER"?"#8ebdc4":"#ddd6bd"}"/>`;
    if(type==="RIVER") {
      content+=`<g transform="translate(${x} ${y})" fill="none" stroke="#d4e7dd" stroke-width="2" opacity=".65"><path d="M18 36 q10 -4 20 0 t20 0 M44 69 q9 -4 18 0 t17 0"/></g>`;
    } else {
      content+=`<g fill="#c3bfa7" opacity=".45"><circle cx="${x+24}" cy="${y+36}" r="1.5"/><circle cx="${x+73}" cy="${y+74}" r="1.4"/></g>`;
      const n=at(r-1,c)==="ROAD", e=at(r,c+1)==="ROAD", s=at(r+1,c)==="ROAD", w=at(r,c-1)==="ROAD";
      const lane=(n||s)&&!e&&!w?"M50 16 V31 M50 69 V84":(e||w)&&!n&&!s?"M16 50 H31 M69 50 H84":"";
      if(lane) content+=`<path transform="translate(${x} ${y})" d="${lane}" fill="none" stroke="#fffaf0" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
    }
    // Only terrain boundaries get an edge; adjacent tiles share a continuous fill.
    const stroke=type==="RIVER"?"#729e9c":"#c5bc9f";
    [[-1,0,"M18 1 H82"],[0,1,"M99 18 V82"],[1,0,"M18 99 H82"],[0,-1,"M1 18 V82"]].forEach(([dr,dc,path])=>{
      if(at(r+dr,c+dc)!==type) content+=`<path transform="translate(${x} ${y})" d="${path}" stroke="${stroke}" stroke-width="2" opacity=".55"/>`;
    });
  }
  // Soften inward corners of a grass pocket. Three matching cells around a
  // vertex curve into the fourth; there is no change to that cell's rules.
  for(let r=1;r<10;r++) for(let c=1;c<10;c++) for(const type of ["ROAD","RIVER"]) {
    const cells=[[r-1,c-1],[r-1,c],[r,c],[r,c-1]];
    const occupied=cells.map(([rr,cc])=>at(rr,cc)===type);
    if(occupied.filter(Boolean).length!==3) continue;
    const missing=occupied.indexOf(false);
    const [rr,cc]=cells[missing];
    if(at(rr,cc)!=="GRASS") continue;
    const rotations=[180,270,0,90];
    content+=`<path transform="translate(${c*100} ${r*100}) rotate(${rotations[missing]})" d="M0 0 H17 Q0 0 0 17 Z" fill="${type==="RIVER"?"#8ebdc4":"#ddd6bd"}"/>`;
  }
  return `<svg class="terrain-art" viewBox="0 0 1000 1000" aria-hidden="true">${content}</svg>`;
}

function addImage(cell,name,className="") {
  const img=document.createElement("img");
  img.src=`./assets/${name}.png`;
  img.alt="";
  img.className=className;
  img.draggable=false;
  cell.appendChild(img);
}

function addUnit(cell,role,id) {
  const thief=role==="thief";
  const ring=document.createElement("span");
  ring.className=look==="emoji"?`legacy-unit ${thief?"thief":""}`:`unit-ring ${thief?"thief":""}`;
  if(look==="emoji") ring.textContent=thief?"🏃":"👮";
  cell.appendChild(ring);
  if(look==="art") addImage(cell,role);
  const badge=document.createElement("span");
  badge.className=`unit-badge ${thief?"thief":""}`;
  badge.textContent=id;
  cell.appendChild(badge);
}

function showCell(r,c) {
  selected={r,c};
  const display=getCellDisplayAt(map,r,c);
  const rules=getCellRuleAt(map,r,c);
  document.querySelector("#cell-position").textContent=`第 ${r+1} 行 · 第 ${c+1} 列`;
  document.querySelector("#cell-name").textContent=TILE_TYPES[display.tileType].name;
  const walk=rules.walkCost===null?"步行不可进入":`步行 ${rules.walkCost/4} 步`;
  const car=rules.driveCost===null?"车辆不可进入":`车辆 ${rules.driveCost/4} 步`;
  const extra=display.tileType==="BANK"?"。小偷到达后拿到钱。":display.tileType==="THIEF_BASE"?"。仅小偷可进入，携款到达后逃脱。":"。";
  document.querySelector("#cell-rule").textContent=`${walk}；${car}${extra}`;
  return `第 ${r+1} 行 ${c+1} 列 · ${TILE_TYPES[display.tileType].name}：${walk}；${car}${extra}`;
}

function render() {
  board.className=`${look} ${document.querySelector("#show-grid").checked?"with-grid":""}`;
  board.innerHTML=look==="art"?terrainArt():"";
  const session=createGameSession(map);
  const moves=document.querySelector("#show-moves").checked
    ? calculateReachableActions({session,turn:"THIEF",diceValue:4,unit:session.thiefUnits[0]}) : new Map();
  for(let r=0;r<10;r++) for(let c=0;c<10;c++) {
    const display=getCellDisplayAt(map,r,c);
    const cell=document.createElement("button");
    cell.type="button";
    cell.className="map-cell";
    cell.dataset.terrain=display.terrain;
    cell.dataset.feature=display.feature?.kind||"";
    cell.dataset.coord=`${r},${c}`;
    cell.setAttribute("aria-label",`第 ${r+1} 行 ${c+1} 列，${TILE_TYPES[display.tileType].name}`);
    if(look==="emoji") cell.textContent=display.markerEmoji;
    else if(display.feature?.kind==="BANK") {
      addImage(cell,"bank","bank-art");
      const label=document.createElement("span");label.className="feature-label";label.textContent="银行";cell.appendChild(label);
    } else if(display.feature) {
      const marker=document.createElement("span");
      const kind=display.feature.kind;
      marker.className=kind==="PARKING"?"parking-marker":kind==="MANHOLE"?"manhole":"home-marker";
      marker.textContent=kind==="PARKING"?"P":kind==="MANHOLE"?"":"基地";
      cell.appendChild(marker);
    }
    const police=session.policeUnits.find(u=>u.r===r&&u.c===c);
    const thief=session.thiefUnits.find(u=>u.r===r&&u.c===c);
    if(police) addUnit(cell,"police",police.id);
    if(thief) addUnit(cell,"thief",thief.id);
    if(moves.has(`${r},${c}`)) {const dot=document.createElement("span");dot.className="move-dot";dot.setAttribute("aria-hidden","true");cell.appendChild(dot);cell.setAttribute("aria-label",`${cell.getAttribute("aria-label")}，小偷可达`);}
    cell.addEventListener("click",()=>{
      if(brush!=="inspect") {
        if(display.feature||display.spawnSide) {feedback.textContent="这格放着地标或角色，请选择旁边的空格试画。";return;}
        selected={r,c};setLegacyTileAt(map,r,c,brush);render();
        feedback.textContent=`已画上${TILE_TYPES[brush].name}，相邻边缘已更新。`;
        board.querySelector(`[data-coord="${r},${c}"]`).focus({preventScroll:true});
      } else feedback.textContent=showCell(r,c);
    });
    board.appendChild(cell);
  }
  showCell(selected.r,selected.c);
}

document.querySelectorAll("[data-look]").forEach(button=>button.addEventListener("click",()=>{
  look=button.dataset.look;
  document.querySelectorAll("[data-look]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));
  document.querySelector("#mode-caption").textContent=look==="art"?"绘本素材":"现有符号（同一地图）";
  render();
}));
document.querySelectorAll("[data-brush]").forEach(button=>button.addEventListener("click",()=>{
  brush=button.dataset.brush;
  document.querySelectorAll("[data-brush]").forEach(b=>b.setAttribute("aria-pressed",String(b===button)));
  feedback.textContent=brush==="inspect"?"点击地块查看规则。":`点击空格画${TILE_TYPES[brush].name}。`;
}));
document.querySelector("#show-grid").addEventListener("change",render);
document.querySelector("#show-moves").addEventListener("change",render);
document.querySelector("#reset").addEventListener("click",()=>{map=createExample();render();feedback.textContent="已恢复河湾小镇示例。";});
render();
