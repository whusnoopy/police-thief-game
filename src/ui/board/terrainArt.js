import { isCrosswalkTileType } from "../../domain/map/crosswalk.js";

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
