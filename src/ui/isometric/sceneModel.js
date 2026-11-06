import { GRID_SIZE } from "../../config/constants.js";
import { getCellDisplayAt } from "../../domain/map/cellDisplay.js";
import { isBridgeTileType } from "../../domain/map/bridgeTopology.js";
import { TILE_ASSETS } from "../board/storybookArt.js";
import { compareSceneDepth, getSurfacePolygon, projectSurfacePoint } from "./projection.js";

export function createIsometricScene(session, projection) {
  const cells = [], objects = [];
  for (let r = 0; r < GRID_SIZE; r += 1) for (let c = 0; c < GRID_SIZE; c += 1) {
    const cell = { r, c, ...getCellDisplayAt(session.mapDefinition, r, c), order: 0 };
    cell.polygon = getSurfacePolygon(cell, projection);
    cell.anchor = projectSurfacePoint(cell, 0, 0, projection);
    cells.push(cell);
    if (isBridgeTileType(cell.tileType)) objects.push({ ...cell, kind: "bridge", order: 1 });
    if (TILE_ASSETS[cell.tileType]) objects.push({ ...cell, kind: "scenery", order: 2 });
    const key = `${r},${c}`;
    if (session.parkingCars.has(key) || session.parkedCars.has(key)) objects.push({ ...cell, kind: "car", order: 3 });
  }
  const cellAt = (unit) => cells[unit.r * GRID_SIZE + unit.c];
  for (const [side, units] of [["animal", session.animalUnits], ["police", session.policeUnits], ["thief", session.thiefUnits]]) {
    for (const unit of units || []) {
      if (side === "thief" && unit.state !== "ACTIVE") continue;
      const cell = cellAt(unit);
      if (cell) objects.push({ ...cell, kind: "unit", side, unit, order: 4 });
    }
  }
  return { cells: cells.sort(compareSceneDepth), objects: objects.sort(compareSceneDepth) };
}
