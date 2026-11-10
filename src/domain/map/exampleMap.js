import { createNewMapDefinition, setLegacyTileAt } from "./mapModel.js";
import { isWithinMap } from "./mapDimensions.js";
import { getTileTypeAt } from "./mapQueries.js";

export const EXAMPLE_MAP_ID = "river-city";
export const EXAMPLE_MAP_NAME = "双岸追缉 · 高架与暗道";

// Coordinates here are zero based; the editor and route guide display 1–20.
export function createExampleMap() {
  const map = createNewMapDefinition({ actionRules: "single" });
  map.meta.name = EXAMPLE_MAP_NAME;
  for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) {
    if (isWithinMap(map, r, c)) map.terrain[r][c] = "GRASS";
  }
  const put = (r, c, type) => {
    setLegacyTileAt(map, r, c, type);
    if (getTileTypeAt(map, r, c) !== type) throw new Error(`Invalid example placement: ${r},${c} ${type}`);
  };
  const row = (r, first, last, type = "ROAD") => {
    for (let c = first; c <= last; c++) put(r, c, type);
  };
  const column = (c, first, last, type = "ROAD") => {
    for (let r = first; r <= last; r++) put(r, c, type);
  };

  // Mountain placement creates its required grass buffer before streets exist.
  for (const [r, c] of [[0,6],[0,7],[1,6],[1,7],[8,0],[9,0],[9,1],[10,0],[10,1],[11,1],[17,17],[17,18],[18,16],[18,17]]) put(r, c, "MOUNTAIN");
  column(9, 0, 19, "RIVER");column(10, 0, 19, "RIVER");
  for (const r of [1,2]) row(r, 15, 17, "RIVER");

  // Two street grids, joined by walkable north/south causeways.
  column(3, 2, 17);column(6, 3, 16);column(7, 3, 16);
  for (const c of [12,13,16]) column(c, 3, 16);
  for (const r of [3,6,12,16]) { row(r, 2, 7);row(r, 12, 16); }
  column(5, 3, 6);
  row(4, 7, 16);row(15, 3, 17);
  row(9, 3, 16);
  for (const r of [8,10]) { row(r, 3, 5);row(r, 13, 16); }
  row(13, 3, 7);row(13, 12, 16);column(15, 12, 16);

  // Keep roads to the riverbank on both sides of the blocked crossing.
  put(13, 8, "ROAD");put(13, 11, "ROAD");
  // A connected elevated junction. Nothing can travel under its footprint.
  row(9, 7, 12, "OVERPASS");column(12, 7, 11, "OVERPASS");
  for (const [r,c,d] of [[9,6,"E"],[9,13,"W"],[6,12,"S"],[12,12,"N"]]) put(r,c,`OVERPASS_RAMP_${d}`);
  // Put crossings at junctions so both pedestrian and vehicle axes have exits.
  for (const [r,c] of [[6,3],[12,16]]) put(r,c,"CROSSWALK_HORIZONTAL");
  for (const [r,c] of [[4,13],[15,6]]) put(r,c,"CROSSWALK_VERTICAL");

  for (const [r,c] of [[4,4],[5,4],[7,4],[7,5],[11,4],[11,5],[13,5],[14,5],[4,15],[5,15],[7,14],[7,15],[11,14],[11,15],[13,14],[17,13]]) put(r,c,"BUILDING");
  for (const [r,c] of [[13,1],[14,1],[6,18],[7,18]]) put(r,c,"CONSTRUCTION_SITE");
  for (const [r,c] of [[8,6],[10,6],[7,2],[11,17]]) put(r,c,"BARRIER");

  for (const [r,c,type] of [
    [5,6,"POLICE_SPAWN"],[14,16,"POLICE_SPAWN"],
    [16,4,"THIEF_SPAWN"],[3,15,"THIEF_SPAWN"],
    [6,4,"BANK"],[12,15,"BANK"],
    [3,4,"THIEF_BASE"],[16,15,"THIEF_BASE"],
    [12,2,"POLICE_STATION"],[6,16,"POLICE_STATION"],
    [6,6,"PARKING"],[15,16,"PARKING"],[16,5,"PARKING"],[3,16,"PARKING"],[10,5,"PARKING"],[10,14,"PARKING"],
    [15,3,"MANHOLE"],[6,5,"MANHOLE"],[4,14,"MANHOLE"],[13,15,"MANHOLE"],
    [14,4,"FARM"],[5,14,"FARM"],
  ]) put(r,c,type);
  return map;
}
