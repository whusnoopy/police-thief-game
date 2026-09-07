export { terrainFamily, neighborMask, terrainArt } from "../../src/ui/board/terrainArt.js";
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
