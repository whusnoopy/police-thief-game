import { getMapDimensions, isWithinMap } from "../../domain/map/mapDimensions.js";
import { getCellDisplayAt } from "../../domain/map/cellDisplay.js";
import { getRampDirection, isBridgeTileType } from "../../domain/map/bridgeTopology.js";
import { getActorLayout } from "./actorLayout.js";
import { SCENERY_ASSETS } from "./assetMetadata.js";
import { getBridgeArtSpec } from "./terrainArt.js";
import { getCrosswalkSignalSpecs } from "./signalArt.js";
import { PARKING_SIGN_BASE } from "./parkingArt.js";
import { compareSceneDepth, getSurfacePolygon, projectSurfacePoint } from "./projection.js";

export function createIsometricStaticScene(mapDefinition, projection) {
  const { rows, cols } = getMapDimensions(mapDefinition);
  const cells = [], objects = [], cellsByPosition = new Map();
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
    if (!isWithinMap(mapDefinition, r, c)) continue;
    const cell = { r, c, ...getCellDisplayAt(mapDefinition, r, c), order: 0 };
    cell.polygon = getSurfacePolygon(cell, projection);
    cell.anchor = projectSurfacePoint(cell, 0, 0, projection);
    cells.push(cell);
    cellsByPosition.set(`${r},${c}`, cell);
    for (const signal of getCrosswalkSignalSpecs(cell.tileType, { mapDefinition, r, c })) {
      objects.push({ ...cell, kind: "signal", signal, depthR: r + signal.localR, depthC: c + signal.localC, order: 2 });
    }
    if (cell.tileType === "PARKING") {
      objects.push({ ...cell, kind: "parking-sign", depthR: r + PARKING_SIGN_BASE.r, depthC: c + PARKING_SIGN_BASE.c, order: 2 });
    }
    if (isBridgeTileType(cell.tileType)) {
      objects.push({ ...cell, kind: "bridge", order: 1 });
      if (getBridgeArtSpec(mapDefinition, r, c).closedEdges.some(edge => edge.front)) objects.push({ ...cell, kind: "bridge-front", order: 5 });
    }
    if (SCENERY_ASSETS[cell.tileType]) {
      const display = SCENERY_ASSETS[cell.tileType].display;
      objects.push({ ...cell, kind: "scenery", depthR: r + (display?.offsetR || 0), depthC: c + (display?.offsetC || 0), order: 2 });
    }
  }
  return {
    cells: cells.sort(compareSceneDepth),
    objects: objects.sort(compareSceneDepth),
    cellsByPosition,
  };
}

export function createIsometricDynamicObjects(session, cellsByPosition, projection, { unitDirections = new Map(), vehicleDirections = new Map() } = {}) {
  const dynamic = [];
  const carKeys = new Set([...(session.parkingCars || []), ...(session.parkedCars || [])]);
  for (const key of carKeys) {
    const cell = cellsByPosition.get(key);
    if (!cell) continue;
    dynamic.push({
      ...cell,
      kind: "car",
      direction: vehicleDirections.get(key) || getRampDirection(cell.tileType)?.direction || "S",
      order: 3,
    });
  }
  for (const [side, units] of [["animal", session.animalUnits], ["police", session.policeUnits], ["thief", session.thiefUnits]]) {
    for (const unit of units || []) {
      if (side === "thief" && unit.state !== "ACTIVE") continue;
      const cell = cellsByPosition.get(`${unit.r},${unit.c}`);
      if (!cell) continue;
      const object = {
        ...cell,
        kind: "unit",
        side,
        unit,
        direction: unitDirections.get(unit.id) || getRampDirection(cell.tileType)?.direction || "S",
        order: 4,
      };
      const layout = getActorLayout(object, projection);
      object.depthR = object.r + layout.localR;
      object.depthC = object.c + layout.localC;
      dynamic.push(object);
    }
  }
  return dynamic.sort(compareSceneDepth);
}

export function createIsometricScene(session, projection, directions = {}) {
  const staticScene = createIsometricStaticScene(session.mapDefinition, projection);
  const dynamicObjects = createIsometricDynamicObjects(session, staticScene.cellsByPosition, projection, directions);
  return {
    cells: staticScene.cells,
    objects: [...staticScene.objects, ...dynamicObjects].sort(compareSceneDepth),
  };
}
