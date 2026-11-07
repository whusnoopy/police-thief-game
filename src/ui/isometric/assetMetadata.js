// Drawing, occlusion and doorway anchors share these world-space transforms.
const LOW_BUILDING = Object.freeze({ scaleR: 0.9, scaleC: 0.9, offsetR: 0, offsetC: 0, scaleHeight: 0.42 });
// These are display anchors only; every object still occupies one map cell.
export const SCENERY_ASSETS = Object.freeze({
  BANK: {
    display: LOW_BUILDING,
    height: 64,
    halfR: 0.34,
    halfC: 0.38,
    front: "S",
    door: { r: 0.43, c: 0 },
    color: "#e6dbb8",
    side: "#c3b992",
    roof: "#879d8a",
  },
  POLICE_STATION: {
    display: LOW_BUILDING,
    height: 68,
    halfR: 0.35,
    halfC: 0.36,
    front: "S",
    door: { r: 0.42, c: 0 },
    color: "#e5e1ce",
    side: "#c4cbbd",
    roof: "#658fa5",
  },
  THIEF_BASE: {
    display: LOW_BUILDING,
    height: 49,
    halfR: 0.29,
    halfC: 0.32,
    front: "S",
    door: { r: 0.36, c: 0 },
    color: "#e8d0a6",
    side: "#c6b08c",
    roof: "#c37b5e",
  },
  FARM: {
    display: LOW_BUILDING,
    height: 49,
    halfR: 0.31,
    halfC: 0.37,
    front: "S",
    door: { r: 0.38, c: 0 },
    color: "#bf7861",
    side: "#965e50",
    roof: "#8ba393",
  },
  BUILDING: {
    display: LOW_BUILDING,
    height: 66,
    halfR: 0.34,
    halfC: 0.35,
    front: "S",
    color: "#e2c9ab",
    side: "#bcae98",
    roof: "#91a8a6",
  },
  CONSTRUCTION_SITE: {
    display: LOW_BUILDING,
    height: 55,
    halfR: 0.34,
    halfC: 0.35,
    front: "S",
    color: "#d3c8b0",
    side: "#aaa88f",
    roof: "#c6c5ae",
  },
  BARRIER: {
    display: { scaleR: 0.9, scaleC: 0.9, offsetR: 0, offsetC: 0, scaleHeight: 0.48 },
    height: 22,
    halfR: 0.1,
    halfC: 0.4,
    front: "S",
    color: "#fff1c9",
    side: "#cbbfa5",
    roof: "#f4deb3",
  },
  MOUNTAIN: {
    height: 64,
    halfR: 0.5,
    halfC: 0.5,
    color: "#a6b59a",
    side: "#859582",
    roof: "#c8d0b1",
  },
});

export const ACTOR_ASSETS = Object.freeze({
  police: { width: 54, height: 54, foot: 0.975, displayScale: 0.86 },
  thief: { width: 54, height: 54, foot: 0.975, displayScale: 0.86 },
  pig: { width: 48, height: 48, foot: 0.88, displayScale: 0.86 },
  cow: { width: 51, height: 51, foot: 0.89, displayScale: 0.86 },
  vehicle: { width: 76, height: 76, foot: 1, displayScale: 0.86 },
});

export function getTrailFacing(action, origin, fallback = "S") {
  let previous = origin,
    direction = fallback;
  for (const position of action.trail || []) {
    const dr = position.r - previous.r,
      dc = position.c - previous.c;
    if (Math.abs(dr) + Math.abs(dc) === 1)
      direction = dr < 0 ? "N" : dr > 0 ? "S" : dc > 0 ? "E" : "W";
    previous = position;
  }
  return direction;
}
