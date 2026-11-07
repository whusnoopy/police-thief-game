import { GRID_SIZE } from "../../config/constants.js";

// Missing dimensions belong to historical 10×10 maps, never the new default.
export function getMapDimensions(mapDefinition = {}) {
  const rows = mapDefinition.meta?.rows === undefined ? GRID_SIZE : mapDefinition.meta.rows;
  const cols = mapDefinition.meta?.cols === undefined ? GRID_SIZE : mapDefinition.meta.cols;
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows !== cols || ![10, 20].includes(rows)) {
    throw new Error("Unsupported map dimensions: expected 10×10 or 20×20");
  }
  return { rows, cols };
}

export function isWithinMap(mapDefinition, r, c) {
  const { rows, cols } = getMapDimensions(mapDefinition);
  if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= rows || c >= cols) return false;
  const cut = getMapCornerCut(rows, cols);
  return Math.min(r + c, r + cols - 1 - c, rows - 1 - r + c, rows + cols - 2 - r - c) >= cut;
}

// All new 20×20 maps share this footprint. Historical 10×10 maps stay square.
export function getMapCornerCut(rows, cols) {
  return rows === 20 && cols === 20 ? 3 : 0;
}
