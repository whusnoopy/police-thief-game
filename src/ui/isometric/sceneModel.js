import { getMapDimensions, isWithinMap } from "../../domain/map/mapDimensions.js";
import { getCellDisplayAt } from "../../domain/map/cellDisplay.js";
import { getRampDirection, isBridgeTileType } from "../../domain/map/bridgeTopology.js";
import { getActorLayout } from "./actorLayout.js";
import { SCENERY_ASSETS } from "./assetMetadata.js";
import { getBridgeArtSpec } from "./terrainArt.js";
import { getCrosswalkSignalSpecs } from "./signalArt.js";
import { compareSceneDepth, getSurfacePolygon, projectSurfacePoint } from "./projection.js";

export function createIsometricScene(session, projection, { unitDirections = new Map(), vehicleDirections = new Map() } = {}) {
  const { rows, cols } = getMapDimensions(session.mapDefinition);
  const cells = [], objects = [], cellsByPosition = new Map();
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
    if (!isWithinMap(session.mapDefinition, r, c)) continue;
    const cell = { r, c, ...getCellDisplayAt(session.mapDefinition, r, c), order: 0 };
    cell.polygon = getSurfacePolygon(cell, projection);
    cell.anchor = projectSurfacePoint(cell, 0, 0, projection);
    cells.push(cell);
    cellsByPosition.set(`${r},${c}`, cell);
    for (const signal of getCrosswalkSignalSpecs(cell.tileType)) {
      objects.push({ ...cell, kind: "signal", signal, depthR: r + signal.localR, depthC: c + signal.localC, order: 2 });
    }
    if (isBridgeTileType(cell.tileType)) {
      objects.push({ ...cell, kind: "bridge", order: 1 });
      if (getBridgeArtSpec(session.mapDefinition,r,c).closedEdges.some(edge=>edge.front)) objects.push({ ...cell, kind: "bridge-front", order: 5 });
    }
    if (SCENERY_ASSETS[cell.tileType]) {
      const display = SCENERY_ASSETS[cell.tileType].display;
      objects.push({ ...cell, kind: "scenery", depthR: r + (display?.offsetR || 0), depthC: c + (display?.offsetC || 0), order: 2 });
    }
    const key = `${r},${c}`;
    if (session.parkingCars.has(key) || session.parkedCars.has(key)) objects.push({ ...cell, kind: "car", direction: vehicleDirections.get(key) || getRampDirection(cell.tileType)?.direction || "S", order: 3 });
  }
  const cellAt = (unit) => cellsByPosition.get(`${unit.r},${unit.c}`);
  for (const [side, units] of [["animal", session.animalUnits], ["police", session.policeUnits], ["thief", session.thiefUnits]]) {
    for (const unit of units || []) {
      if (side === "thief" && unit.state !== "ACTIVE") continue;
      const cell = cellAt(unit);
      if (cell) {
        const object = { ...cell, kind: "unit", side, unit, direction: unitDirections.get(unit.id) || getRampDirection(cell.tileType)?.direction || "S", order: 4 };
        const layout = getActorLayout(object, projection);
        object.depthR = object.r + layout.localR;
        object.depthC = object.c + layout.localC;
        objects.push(object);
      }
    }
  }
  return { cells: cells.sort(compareSceneDepth), objects: objects.sort(compareSceneDepth) };
}
