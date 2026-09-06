import { getCrosswalkSignalPositions, isCrosswalkTileType } from "../../src/domain/map/crosswalk.js";

export const ASSETS = [
  ["police", "警察"], ["thief", "小偷"], ["bank", "银行"],
  ["police-station", "警察局"], ["thief-base", "小偷基地"],
  ["police-car", "警车"], ["car", "普通车"], ["pig", "猪"], ["cow", "牛"],
  ["farm", "农场"], ["building", "普通建筑"],
  ["construction-site", "建筑工地"], ["barrier", "路障"], ["mountain", "山"],
];
export const TILE_ASSETS = {
  BANK: "bank", POLICE_STATION: "police-station", THIEF_BASE: "thief-base",
  FARM: "farm", BUILDING: "building", CONSTRUCTION_SITE: "construction-site",
  BARRIER: "barrier", MOUNTAIN: "mountain",
};

export function terrainFamily(type) {
  return isCrosswalkTileType(type) ? "ROAD" : type;
}

// Bit order N/E/S/W. Features keep their underlying terrain. Neither diagonal
// contacts nor decorative corner curves alter the square-cell movement graph.
export function neighborMask(map, r, c) {
  const family = terrainFamily(map.terrain[r]?.[c]);
  return [[-1,0],[0,1],[1,0],[0,-1]].reduce((mask,[dr,dc],i) =>
    mask | (terrainFamily(map.terrain[r+dr]?.[c+dc]) === family ? 1 << i : 0), 0);
}

function tilePath(mask) {
  const n=mask&1, e=mask&2, s=mask&4, w=mask&8;
  const tl=!n&&!w?17:0, tr=!n&&!e?17:0, br=!s&&!e?17:0, bl=!s&&!w?17:0;
  return `M${tl} 0 H${100-tr} Q100 0 100 ${tr} V${100-br} Q100 100 ${100-br} 100 H${bl} Q0 100 0 ${100-bl} V${tl} Q0 0 ${tl} 0 Z`;
}

export function terrainArt(map) {
  const at=(r,c)=>terrainFamily(map.terrain[r]?.[c]);
  const fills={ROAD:"#ddd6bd",RIVER:"#8ebdc4",OVERPASS:"#a9b5b5",BUILDING:"#cec9ba",CONSTRUCTION_SITE:"#dbccb0",BARRIER:"#cec9ba",MOUNTAIN:"#b4bda7"};
  let content='<rect width="1000" height="1000" fill="#b9cea0"/>';
  for(let r=0;r<10;r++) for(let c=0;c<10;c++) {
    const type=at(r,c), raw=map.terrain[r][c], x=c*100, y=r*100;
    const mask=neighborMask(map,r,c);
    if(type==="GRASS") {
      const shift=(r*17+c*23)%35;
      content+=`<g transform="translate(${x+15+shift} ${y+24+shift/2})" stroke="#93af81" fill="none" stroke-width="2" opacity=".45"><path d="M0 6 l-3 -7 M0 6 l4 -9 M0 6 l8 -3"/></g>`;
      continue;
    }
    content+=`<path data-tile="${r},${c}" data-mask="${mask}" transform="translate(${x} ${y})" d="${tilePath(mask)}" fill="${fills[type] || fills.ROAD}"/>`;
    if(type==="RIVER") {
      content+=`<g transform="translate(${x} ${y})" fill="none" stroke="#d4e7dd" stroke-width="2" opacity=".65"><path d="M18 36 q10 -4 20 0 t20 0 M44 69 q9 -4 18 0 t17 0"/></g>`;
    } else if(type==="OVERPASS") {
      // Crosswise expansion joints communicate a raised deck without inventing
      // a directional constraint or a second traversable level.
      content+=`<g transform="translate(${x} ${y})" stroke="#dce1d8" stroke-width="2" opacity=".65"><path d="M18 26 H82 M18 74 H82 M26 18 V82 M74 18 V82"/></g>`;
    } else if(isCrosswalkTileType(raw)) {
      const vertical=raw==="CROSSWALK_VERTICAL";
      let stripes="";
      for(let i=0;i<5;i++) stripes+=`<rect x="${20+i*13}" y="23" width="7" height="54" rx="1"/>`;
      content+=`<g transform="translate(${x} ${y}) ${vertical?"rotate(90 50 50)":""}" fill="#fffdf1">${stripes}</g>`;
    } else if(type==="ROAD") {
      content+=`<g fill="#c3bfa7" opacity=".45"><circle cx="${x+24}" cy="${y+36}" r="1.5"/><circle cx="${x+73}" cy="${y+74}" r="1.4"/></g>`;
      const n=mask&1,e=mask&2,s=mask&4,w=mask&8;
      const lane=(n||s)&&!e&&!w?"M50 16 V31 M50 69 V84":(e||w)&&!n&&!s?"M16 50 H31 M69 50 H84":"";
      if(lane) content+=`<path transform="translate(${x} ${y})" d="${lane}" stroke="#fffaf0" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
    }
    const stroke=type==="RIVER"?"#729e9c":type==="OVERPASS"?"#687e86":"#c5bc9f";
    // Edges run right to a shared junction. Outer rounded corners shorten both
    // adjoining strokes; curved strokes complete the corners, avoiding dashes.
    const n=mask&1,e=mask&2,s=mask&4,w=mask&8;
    const tl=!n&&!w?17:0,tr=!n&&!e?17:0,br=!s&&!e?17:0,bl=!s&&!w?17:0;
    let edge="";
    if(!n) edge+=`M${tl} 1 H${100-tr} `;
    if(!e) edge+=`M99 ${tr} V${100-br} `;
    if(!s) edge+=`M${100-br} 99 H${bl} `;
    if(!w) edge+=`M1 ${100-bl} V${tl} `;
    if(tl) edge+="M1 17 Q1 1 17 1 ";if(tr) edge+="M83 1 Q99 1 99 17 ";
    if(br) edge+="M99 83 Q99 99 83 99 ";if(bl) edge+="M17 99 Q1 99 1 83 ";
    content+=`<path transform="translate(${x} ${y})" d="${edge}" fill="none" stroke="${stroke}" stroke-width="${type==="OVERPASS"?4:2}" opacity=".6"/>`;
  }
  for(let r=1;r<10;r++) for(let c=1;c<10;c++) for(const type of ["ROAD","RIVER","OVERPASS"]) {
    const cells=[[r-1,c-1],[r-1,c],[r,c],[r,c-1]];
    const occupied=cells.map(([rr,cc])=>at(rr,cc)===type);
    if(occupied.filter(Boolean).length!==3) continue;
    const missing=occupied.indexOf(false), [rr,cc]=cells[missing];
    if(at(rr,cc)!=="GRASS") continue;
    content+=`<path data-inner-corner="${r},${c}" transform="translate(${c*100} ${r*100}) rotate(${[180,270,0,90][missing]})" d="M0 0 H17 Q0 0 0 17 Z" fill="${fills[type]}"/>`;
  }
  return `<svg class="terrain-art" viewBox="0 0 1000 1000" aria-hidden="true">${content}</svg>`;
}

export function addImage(cell,name,className="") {
  const img=document.createElement("img");
  img.src=new URL(`./assets/${name}.png`,import.meta.url).href;
  img.alt="";img.className=className;img.draggable=false;
  img.addEventListener("error",()=>{
    img.remove();const fallback=document.createElement("span");
    fallback.className="asset-fallback";fallback.textContent=ASSETS.find(a=>a[0]===name)?.[1]||name;cell.appendChild(fallback);
  },{once:true});
  cell.appendChild(img);
}

const ICONS={
  money:'<path d="M9 9 7 3h10l-2 6c6 4 8 12-3 12S3 13 9 9Z" fill="#e7c36f" stroke="#84693d" stroke-width="1.6"/><path d="M8 9h8" stroke="#84693d" stroke-width="2"/><circle cx="12" cy="15" r="2" fill="none" stroke="#84693d"/>',
  escort:'<g fill="none" stroke="#54768d" stroke-width="2.5"><circle cx="6" cy="14" r="4"/><circle cx="18" cy="9" r="4"/><path d="m9 11 6-1"/></g>',
  signal:'<rect x="7" y="2" width="10" height="17" rx="3" fill="#526c6a"/><path d="M12 19v4" stroke="#526c6a" stroke-width="2"/><circle cx="12" cy="6" r="2" fill="#d5806d"/><circle cx="12" cy="11" r="2" fill="#e4c57b"/><circle cx="12" cy="16" r="2" fill="#94bd90"/>',
};
export function iconSvg(name) {return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||""}</svg>`;}

export function addFeature(cell,display,green=true) {
  const name=TILE_ASSETS[display.tileType];
  if(name) {
    addImage(cell,name,"building-art");
    const label=document.createElement("span");label.className="feature-label";
    label.textContent=ASSETS.find(a=>a[0]===name)[1];cell.appendChild(label);
  }
  if(display.feature?.kind==="PARKING") {
    const p=document.createElement("span");p.className="parking-marker";p.textContent="P";cell.appendChild(p);
  }
  if(display.feature?.kind==="MANHOLE") {
    const hole=document.createElement("span");hole.className="manhole";cell.appendChild(hole);
  }
  if(display.feature?.kind==="TRAFFIC_LIGHT") {
    const sign=document.createElement("span");sign.className="functional-icon";sign.innerHTML=iconSvg("signal");cell.appendChild(sign);
  }
  if(display.spawnSide) {
    const spawn=document.createElement("span");spawn.className=`spawn-marker ${display.spawnSide.toLowerCase()}`;
    spawn.textContent=display.spawnSide==="POLICE"?"P":"T";cell.appendChild(spawn);
  }
  getCrosswalkSignalPositions(display.tileType).forEach(position=>{
    const light=document.createElement("span");light.className=`crosswalk-signal ${position} ${green?"green":"red"}`;
    light.title=green?"行人绿灯":"行人红灯";cell.appendChild(light);
  });
}

export function addUnit(cell,{role,id,inCar=false,hasMoney=false,carrying=false},look="art") {
  const thief=role==="thief", animal=role==="pig"||role==="cow";
  const ring=document.createElement("span");
  ring.className=look==="emoji"?`legacy-unit ${thief?"thief":""}`:`unit-ring ${animal?"animal":thief?"thief":""}`;
  if(look==="emoji") ring.textContent=animal?(role==="pig"?"🐷":"🐮"):inCar?(thief?"🚗":"🚓"):(thief?"🏃":"👮");
  cell.appendChild(ring);
  if(look==="art") addImage(cell,inCar?(thief?"car":"police-car"):role,"unit-art");
  if(!animal) {
    const badge=document.createElement("span");badge.className=`unit-badge ${thief?"thief":""}`;badge.textContent=id;cell.appendChild(badge);
  }
  if(hasMoney||carrying) {
    const badge=document.createElement("span");badge.className="state-badge";
    badge.title=hasMoney?"携款":"押送小偷";badge.setAttribute("role","img");badge.setAttribute("aria-label",badge.title);
    badge.innerHTML=iconSvg(hasMoney?"money":"escort");cell.appendChild(badge);
  }
  if(cell.querySelector(".building-art")) cell.classList.add("occupied-feature");
}
