import test from "node:test";
import assert from "node:assert/strict";
import { BRIDGE_DIRECTIONS } from "../src/domain/map/bridgeTopology.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { createIsometricScene } from "../src/ui/isometric/sceneModel.js";
import { createIsometricProjection, getSurfacePolygon, pickSurface, pointInPolygon, projectPoint, projectSurfacePoint, surfaceHeightAt, unprojectPoint } from "../src/ui/isometric/projection.js";
import { createRampScenario } from "./helpers/rampScenario.js";

const projection = createIsometricProjection();
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test("isometric projection round-trips fractional map positions at ground, ramp and bridge heights", () => {
  for (const r of [-0.5, 0, 4.25, 9, 9.5]) for (const c of [-0.5, 0, 6.75, 9, 9.5]) for (const z of [0, 0.5, 1]) {
    const screen = projectPoint({ r, c, z }, projection);
    const actual = unprojectPoint(screen, projection, z);
    near(actual.r, r); near(actual.c, c);
    assert.ok(screen.x >= 0 && screen.x <= projection.width);
    assert.ok(screen.y >= 0 && screen.y <= projection.height);
  }
});

test("all four ramp planes join the exact ground and bridge edges without changing logical coordinates", () => {
  for (const { direction, dr, dc } of BRIDGE_DIRECTIONS) {
    const cell = { r: 4, c: 4, tileType: `OVERPASS_RAMP_${direction}` };
    near(surfaceHeightAt(cell.tileType), 0.5);
    near(surfaceHeightAt(cell.tileType, dr / 2, dc / 2), 1);
    near(surfaceHeightAt(cell.tileType, -dr / 2, -dc / 2), 0);
    for (const offset of [-0.5, 0, 0.5]) {
      for (const sign of [-1, 1]) {
        const localR = sign * dr / 2 - dc * offset, localC = sign * dc / 2 + dr * offset;
        const rampEdge = projectSurfacePoint(cell, localR, localC, projection);
        const adjacentEdge = projectSurfacePoint({ r: cell.r + sign * dr, c: cell.c + sign * dc, tileType: sign > 0 ? "OVERPASS" : "ROAD" }, localR - sign * dr, localC - sign * dc, projection);
        near(rampEdge.x, adjacentEdge.x); near(rampEdge.y, adjacentEdge.y);
      }
    }
    const polygon = getSurfacePolygon(cell, projection);
    assert.ok(pointInPolygon(projectSurfacePoint(cell, 0, 0, projection), polygon));
    assert.ok(!pointInPolygon({ x: -100, y: -100 }, polygon));
  }
});

test("surface picking follows raised polygons and explicit action targets instead of a flat inverse", () => {
  const ground = { r: 3, c: 3, tileType: "ROAD" }, bridge = { r: 4, c: 4, tileType: "OVERPASS" };
  for (const cell of [ground, bridge]) cell.polygon = getSurfacePolygon(cell, projection);
  const point = projectSurfacePoint(bridge, -0.4, -0.4, projection);
  const flat = unprojectPoint(point, projection);
  assert.equal(Math.round(flat.r), 3);
  assert.equal(pickSurface(point, [ground, bridge]), bridge);
  assert.equal(pickSurface(point, [ground, bridge], new Set(["3,3"])), ground);
  assert.equal(pickSurface({ x: 0, y: 0 }, [ground, bridge]), null);
  assert.equal(pickSurface({ x: NaN, y: 0 }, [ground, bridge]), null);
  assert.equal(pickSurface({ x: 0, y: Infinity }, [ground, bridge]), null);
});

test("every cell centre picks correctly on all four ramp layouts", () => {
  for (const { direction } of BRIDGE_DIRECTIONS) {
    const { map } = createRampScenario(direction);
    const { cells } = createIsometricScene(createGameSession(map), projection);
    for (const cell of cells) {
      const actual = pickSurface(cell.anchor, cells, new Set([`${cell.r},${cell.c}`]));
      assert.equal(actual, cell);
    }
  }
});

test("scene sorting interleaves scenery, bridges and units by map depth and retains bank occupancy", () => {
  const { map, positions } = createRampScenario();
  const session = createGameSession(map);
  Object.assign(session.thiefUnits[0], positions.end, { hasMoney: true });
  session.animalUnits.push({ id: "A1", r: 2, c: 2, emoji: "🐷" });
  session.thiefUnits.push({ id: "T2", r: 1, c: 1, state: "ESCAPED" });
  const before = JSON.stringify(session);
  const scene = createIsometricScene(session, projection);
  const occupant = scene.objects.find(object => object.unit?.id === "T1");
  const bank = scene.objects.find(object => object.tileType === "BANK" && object.kind === "scenery");
  const front = scene.objects.find(object => object.kind === "scenery" && object.r + object.c > occupant.r + occupant.c);
  assert.ok(scene.objects.indexOf(bank) < scene.objects.indexOf(occupant));
  assert.ok(scene.objects.indexOf(occupant) < scene.objects.indexOf(front));
  assert.equal(scene.objects.filter(object => object.kind === "unit").length, 3);
  assert.equal(JSON.stringify(session), before);
});
