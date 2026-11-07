import { ACTOR_ASSETS, SCENERY_ASSETS } from "./assetMetadata.js";
import { projectSurfacePoint } from "./projection.js";

export function getActorLayout(cell, projection) {
  const vehicle = cell.kind === "car" || Boolean(cell.unit?.inCar);
  const name = vehicle
    ? cell.side === "police"
      ? "police-car"
      : "car"
    : cell.side === "animal"
      ? /🐮|🐄/.test(cell.unit.emoji)
        ? "cow"
        : "pig"
      : cell.side;
  const asset = ACTOR_ASSETS[vehicle ? "vehicle" : name];
  const facility = SCENERY_ASSETS[cell.tileType];
  let scale = asset.displayScale ?? 1,
    localR = 0,
    localC = 0;
  let placement = "surface";
  if (facility?.door && cell.side !== "animal") {
    if (vehicle) {
      // Beside the building, rather than scaling a car down to the doorway.
      scale *= 0.9;
      localR = 0.34;
      localC = -0.19;
      placement = "driveway";
    } else {
      const t = facility.display;
      localR = facility.door.r * (t?.scaleR ?? 1) + (t?.offsetR ?? 0);
      localC = facility.door.c * (t?.scaleC ?? 1) + (t?.offsetC ?? 0);
      scale *= 0.5;
      placement = "doorway";
    }
  }
  const foot = projectSurfacePoint(cell, localR, localC, projection);
  const width = asset.width * scale,
    height = asset.height * scale;
  const left = foot.x - width / 2;
  const top = foot.y - (vehicle ? 50 : asset.height * asset.foot) * scale;
  return {
    name,
    vehicle,
    scale,
    placement,
    localR,
    localC,
    foot,
    left,
    top,
    width,
    height,
    bounds: { x: left, y: top, width, height },
  };
}
