import { GRID_SIZE } from "../../config/constants.js";
import { getRampDirection, getSurfaceHeight } from "../../domain/map/bridgeTopology.js";

export function createIsometricProjection({ size = GRID_SIZE, tileWidth = 80, tileHeight = 40, bridgeHeight = 16, padding = 48, headroom = 100 } = {}) {
  return {
    size, tileWidth, tileHeight, bridgeHeight,
    originX: padding + size * tileWidth / 2,
    originY: headroom + tileHeight / 2,
    width: padding * 2 + size * tileWidth,
    height: headroom + size * tileHeight + padding,
  };
}

// r/c refer to cell centres. z is a display height, never another logical cell.
export function projectPoint({ r, c, z = 0 }, projection) {
  return {
    x: projection.originX + (c - r) * projection.tileWidth / 2,
    y: projection.originY + (c + r) * projection.tileHeight / 2 - z * projection.bridgeHeight,
  };
}

export function unprojectPoint({ x, y }, projection, z = 0) {
  const difference = (x - projection.originX) / (projection.tileWidth / 2);
  const sum = (y - projection.originY + z * projection.bridgeHeight) / (projection.tileHeight / 2);
  return { r: (sum - difference) / 2, c: (sum + difference) / 2 };
}

export function surfaceHeightAt(tileType, localR = 0, localC = 0) {
  const ramp = getRampDirection(tileType);
  // Display relief only; these offsets never enter the movement/rules model.
  if (tileType === "RIVER") return -0.25;
  if (tileType === "GRASS") return 0.125;
  return ramp ? 0.5 + localR * ramp.dr + localC * ramp.dc : getSurfaceHeight(tileType);
}

export function projectSurfacePoint(cell, localR, localC, projection) {
  return projectPoint({
    r: cell.r + localR, c: cell.c + localC,
    z: surfaceHeightAt(cell.tileType, localR, localC),
  }, projection);
}

export function getSurfacePolygon(cell, projection) {
  return [[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0.5, -0.5]]
    .map(([r, c]) => projectSurfacePoint(cell, r, c, projection));
}

export function pointInPolygon(point, polygon) {
  // Convex surfaces include their shared edges; painter order breaks ties.
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || polygon.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) < 1e-7) continue;
    const nextSign = Math.sign(cross);
    if (sign && nextSign !== sign) return false;
    sign = nextSign;
  }
  return sign !== 0;
}

export function compareSceneDepth(a, b) {
  const ar = a.depthR ?? a.r, ac = a.depthC ?? a.c;
  const br = b.depthR ?? b.r, bc = b.depthC ?? b.c;
  return (ar + ac) - (br + bc) || ac - bc || a.order - b.order;
}

// Elevated and sloped surfaces must be tested in screen space. A flat inverse
// alone selects the cell behind a bridge. Explicit action targets win overlaps.
export function pickSurface(point, surfaces, preferredKeys = new Set()) {
  let top = null;
  for (let i = surfaces.length - 1; i >= 0; i -= 1) {
    const cell = surfaces[i];
    if (!pointInPolygon(point, cell.polygon)) continue;
    if (preferredKeys.has(`${cell.r},${cell.c}`)) return cell;
    top ||= cell;
  }
  return top;
}
