import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";
import {
  createRampMapDefinition,
  setLegacyTileAt,
} from "../src/domain/map/mapModel.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { BRIDGE_DIRECTIONS } from "../src/domain/map/bridgeTopology.js";
import {
  createIsometricProjection,
  projectSurfacePoint,
} from "../src/ui/isometric/projection.js";
import { createIsometricScene } from "../src/ui/isometric/sceneModel.js";
import {
  SCENERY_ASSETS,
  getTrailFacing,
} from "../src/ui/isometric/assetMetadata.js";
import {
  getBridgeArtSpec,
  renderBridgeDeck,
  renderBridgeRails,
  renderBridgeShadow,
  renderGround,
} from "../src/ui/isometric/terrainArt.js";
import {
  getMountainProfile,
  renderScenery,
} from "../src/ui/isometric/sceneryArt.js";
import { appendVehicleArtwork } from "../src/ui/isometric/vehicleArt.js";

import { getCrosswalkSignalSpecs, renderCrosswalkSignal } from "../src/ui/isometric/signalArt.js";

const env = createTestEnvironment();
env.installGlobals();
const projection = createIsometricProjection();
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const vertices = (element) =>
  element.attributes.points.split(" ").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return { x, y };
  });
function makeCell(tileType) {
  const map = createRampMapDefinition();
  setLegacyTileAt(map, 4, 4, tileType);
  const cell = createIsometricScene(
    createGameSession(map),
    projection,
  ).cells.find((cell) => cell.r === 4 && cell.c === 4);
  return { map, cell };
}

test("all 16 bridge art combinations leave only the traversable edges open", () => {
  for (let mask = 0; mask < 16; mask += 1) {
    const { map, cell } = makeCell("OVERPASS");
    BRIDGE_DIRECTIONS.forEach((d, index) => {
      if (mask & (1 << index))
        setLegacyTileAt(map, 4 + d.dr, 4 + d.dc, "OVERPASS");
    });
    const root = env.document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    renderBridgeDeck(root, cell, projection, map);
    renderBridgeRails(root, cell, projection, map, true);
    const closed = BRIDGE_DIRECTIONS.filter((_, i) => !(mask & (1 << i)))
      .map((d) => d.direction)
      .sort();
    assert.equal(getBridgeArtSpec(map, 4, 4).mask, mask);
    assert.deepEqual(
      root
        .querySelectorAll(".iso-bridge-rail")
        .map((e) => e.attributes["data-edge"])
        .sort(),
      closed,
    );
    assert.equal(
      root.querySelectorAll(".iso-surface")[0].attributes[
        "data-connection-mask"
      ],
      String(mask),
    );
  }
});

test("ramp rails follow all four inclined planes and close only the side edges", () => {
  for (const d of BRIDGE_DIRECTIONS) {
    const { map, cell } = makeCell(`OVERPASS_RAMP_${d.direction}`);
    setLegacyTileAt(map, 4 + d.dr, 4 + d.dc, "OVERPASS");
    const root = env.document.createElement("div");
    renderBridgeDeck(root, cell, projection, map);
    renderBridgeRails(root, cell, projection, map, true);
    const spec = getBridgeArtSpec(map, 4, 4);
    assert.equal(spec.closedEdges.length, 2);
    for (const rail of root.querySelectorAll(".iso-bridge-rail")) {
      const edge = spec.closedEdges.find(
        (edge) => edge.direction === rail.attributes["data-edge"],
      );
      const top = rail.querySelectorAll("line").at(-1);
      const expectedA = projectSurfacePoint(cell, ...edge.from, projection),
        expectedB = projectSurfacePoint(cell, ...edge.to, projection);
      near(+top.attributes.x1, expectedA.x);
      near(+top.attributes.y1, expectedA.y - 6);
      near(+top.attributes.x2, expectedB.x);
      near(+top.attributes.y2, expectedB.y - 6);
    }
  }
});

test("bridge deck and rear rails precede its car, and the near rail is drawn after the car", () => {
  const { map } = makeCell("OVERPASS");
  const session = createGameSession(map);
  session.thiefUnits.push({
    id: "T1",
    r: 4,
    c: 4,
    state: "ACTIVE",
    inCar: true,
  });
  const { objects } = createIsometricScene(session, projection);
  const kinds = objects
    .filter((o) => o.r === 4 && o.c === 4)
    .map((o) => o.kind);
  assert.deepEqual(kinds, ["bridge", "unit", "bridge-front"]);
});

test("both vehicle types have distinct cardinal views and remain on the actual road or ramp plane", () => {
  for (const police of [false, true])
    for (const type of [
      "ROAD",
      "RIVER",
      "OVERPASS",
      ...BRIDGE_DIRECTIONS.map((d) => `OVERPASS_RAMP_${d.direction}`),
    ]) {
      const { cell } = makeCell(type);
      const shapes = [];
      for (const d of BRIDGE_DIRECTIONS) {
        const root = env.document.createElement("div");
        const art = appendVehicleArtwork(
          root,
          cell,
          projection,
          d.direction,
          police,
        );
        const [x, y, w, h] = art.attributes.viewBox.split(" ").map(Number);
        for (const polygon of art.querySelectorAll("polygon"))
          for (const p of vertices(polygon)) {
            assert.ok(
              p.x >= x - 1 &&
                p.x <= x + w + 1 &&
                p.y >= y - 1 &&
                p.y <= y + h + 1,
              `${type}/${d.direction} cropped`,
            );
          }
        for (const path of art.querySelectorAll("path")) {
          for (const match of path.attributes.d.matchAll(/[ML]([^ ,]+),([^ ]+)/g)) {
            const px = Number(match[1]), py = Number(match[2]);
            assert.ok(Number.isFinite(px) && Number.isFinite(py));
            assert.ok(px >= x - 1 && px <= x + w + 1 && py >= y - 1 && py <= y + h + 1, `${type}/${d.direction} detail cropped`);
          }
        }
        const shadow = vertices(art.querySelectorAll(".iso-vehicle-shadow")[0]);
        const corners = [
          [-0.44, -0.26],
          [-0.44, 0.26],
          [0.44, 0.26],
          [0.44, -0.26],
        ];
        corners.forEach(([f, s], i) => {
          const expected = projectSurfacePoint(
            cell,
            d.dr * f - d.dc * s,
            d.dc * f + d.dr * s,
            projection,
          );
          near(shadow[i].x, expected.x);
          near(shadow[i].y, expected.y);
        });
        shapes.push(
          art
            .querySelectorAll("polygon")
            .map((p) => `${p.attributes.points}/${p.attributes.fill}`)
            .join("|"),
        );
      }
      assert.equal(new Set(shapes).size, 4);
    }
});

test("buildings use the board's projected façade axes and do not mutate the map", () => {
  for (const type of Object.keys(SCENERY_ASSETS)) {
    const { map, cell } = makeCell(type),
      before = JSON.stringify(map);
    const root = env.document.createElement("div");
    renderScenery(root, cell, projection, map);
    assert.ok(root.querySelectorAll("polygon").length >= 3);
    assert.equal(root.querySelectorAll("img").length, 0);
    if (type !== "MOUNTAIN") {
      assert.equal(root.attributes["data-front"], "S");
      const face = vertices(root.querySelectorAll("polygon")[0]);
      near((face[1].y - face[0].y) / (face[1].x - face[0].x), 0.5);
    }
    assert.equal(JSON.stringify(map), before);
  }
});

test("adjacent mountain cells share identical ridge and corner heights", () => {
  const { map } = makeCell("MOUNTAIN");
  for (const [r, c] of [
    [4, 5],
    [5, 4],
    [5, 5],
  ])
    setLegacyTileAt(map, r, c, "MOUNTAIN");
  for (const [r, c, dr, dc] of [
    [4, 4, 0, 1],
    [4, 4, 1, 0],
    [4, 5, 1, 0],
    [5, 4, 0, 1],
  ]) {
    const a = getMountainProfile(map, r, c),
      b = getMountainProfile(map, r + dr, c + dc);
    const edge = (profile, sign) =>
      profile.ring
        .filter(([rr, cc]) => (dr ? rr === sign * 0.5 : cc === sign * 0.5))
        .map(([rr, cc, h]) => ({ axis: dr ? cc : rr, h }))
        .sort((a, b) => a.axis - b.axis);
    assert.deepEqual(edge(a, 1), edge(b, -1));
    assert.ok(edge(a, 1)[1].h > 0);
  }
});

test("visual heading uses the last real step, ignoring boarding, parking and distant teleports", () => {
  const origin = { r: 4, c: 4 };
  for (const d of BRIDGE_DIRECTIONS) {
    const p = { r: origin.r + d.dr, c: origin.c + d.dc };
    assert.equal(
      getTrailFacing(
        {
          trail: [
            p,
            { ...p, movementKind: "BOARD" },
            { ...p, movementKind: "PARK" },
          ],
        },
        origin,
      ),
      d.direction,
    );
  }
  assert.equal(getTrailFacing({ trail: [{ r: 8, c: 8 }] }, origin, "W"), "W");
  assert.equal(
    getTrailFacing(
      {
        trail: [
          { r: 8, c: 8 },
          { r: 8, c: 7 },
        ],
      },
      origin,
      "E",
    ),
    "W",
  );
});

test("bridge shadows stay in their display layer at map edges", () => {
  const map = createRampMapDefinition();
  for (const [r, c] of [
    [0, 0],
    [0, 9],
    [9, 0],
    [9, 9],
  ])
    setLegacyTileAt(map, r, c, "OVERPASS");
  const scene = createIsometricScene(createGameSession(map), projection);
  for (const cell of scene.cells.filter(
    (cell) => cell.tileType === "OVERPASS",
  )) {
    const root = env.document.createElement("div");
    renderBridgeShadow(root, cell, projection);
    const shadow = vertices(root.querySelectorAll("polygon")[0]);
    cell.polygon.forEach((p, i) => {
      near(shadow[i].x - p.x, 5);
      near(shadow[i].y - p.y, 10);
    });
    assert.ok(getBridgeArtSpec(map, cell.r, cell.c).closedEdges.length >= 2);
  }
 });

test("crossing poles face pedestrians on the correct axis, with lit fronts and opaque backs in both phases", () => {
  assert.deepEqual(getCrosswalkSignalSpecs("ROAD"), []);
  for (const type of ["CROSSWALK_HORIZONTAL", "CROSSWALK_VERTICAL", "CROSSWALK"]) {
    const { map, cell } = makeCell(type);
    const specs = getCrosswalkSignalSpecs(type);
    assert.equal(specs.length, 2);
    for (const signal of specs) {
      assert.ok(signal.localR * signal.dr + signal.localC * signal.dc < 0, "heads face into the crossing");
      assert.ok(Math.max(Math.abs(signal.localR), Math.abs(signal.localC)) < 0.5);
      assert.equal(signal.dr, type === "CROSSWALK_VERTICAL" ? -Math.sign(signal.localR) : 0);
      assert.equal(signal.dc, type === "CROSSWALK_VERTICAL" ? 0 : -Math.sign(signal.localC));
    }
    for (const [phase, color] of [["PEDESTRIAN_GREEN", "green"], ["PEDESTRIAN_RED", "red"]]) {
      const root = env.document.createElement("div");
      renderGround(root, cell, projection, { mapDefinition: map, signalPhase: phase });
      assert.equal(root.querySelectorAll(".iso-signal-pole").length, 0, "poles belong to the depth-sorted objects");
      for (const signal of specs) renderCrosswalkSignal(root, { ...cell, signal }, projection, phase);
      assert.equal(root.querySelectorAll(`.${color}`).length, 2);
      assert.equal(root.querySelectorAll(".iso-signal-pole").length, 2);
      const heads = root.querySelectorAll(".iso-crosswalk-signal");
      assert.equal(heads.filter(e => e.attributes["data-face"] === "front").length, 1);
      assert.equal(heads.filter(e => e.attributes["data-face"] === "back").length, 1);
      assert.equal(root.querySelectorAll(".lit").length, 1, "only the lens facing the camera is visible");
      assert.equal(heads.find(e => e.attributes["data-face"] === "back").querySelectorAll(".iso-signal-lens").length, 0);
    }
  }
});

test("signal poles interleave with occupants at their actual bases without changing logical cells", () => {
  for (const type of ["CROSSWALK_HORIZONTAL", "CROSSWALK_VERTICAL"]) {
    const { map } = makeCell(type);
    const session = createGameSession(map);
    session.thiefUnits.push({ id: "T1", r: 4, c: 4, state: "ACTIVE", inCar: false });
    const before = JSON.stringify(session);
    const scene = createIsometricScene(session, projection);
    const objects = scene.objects.filter(o => o.r === 4 && o.c === 4);
    assert.deepEqual(objects.map(o => o.kind), ["signal", "unit", "signal"]);
    assert.ok(objects[0].depthR + objects[0].depthC < 8);
    assert.ok(objects[2].depthR + objects[2].depthC > 8);
    assert.equal(JSON.stringify(session), before);
  }
});

test("river banks and turf edges appear only on exposed edges and leave matching neighbours continuous", () => {
  for (const type of ["RIVER", "GRASS"]) {
    const { map, cell } = makeCell(type);
    for (const d of BRIDGE_DIRECTIONS) setLegacyTileAt(map, cell.r + d.dr, cell.c + d.dc, type);
    const draw = () => {
      const root = env.document.createElement("div");
      renderGround(root, cell, projection, { mapDefinition: map });
      return root;
    };
    const sameNeighbours = draw();
    assert.equal(sameNeighbours.querySelectorAll(".iso-shore-rim").length, 0);
    assert.equal(sameNeighbours.querySelectorAll(".iso-turf-edge").length, 0);
    assert.equal(sameNeighbours.querySelectorAll(".iso-river-bank").length, 0);
    for (const d of BRIDGE_DIRECTIONS) setLegacyTileAt(map, cell.r + d.dr, cell.c + d.dc, "ROAD");
    const exposed = draw();
    const ground = vertices(exposed.querySelectorAll(".iso-ground-face")[0]);
    ground.forEach((point, i) => { near(point.x, cell.polygon[i].x); near(point.y, cell.polygon[i].y); });
    if (type === "RIVER") {
      assert.equal(exposed.querySelectorAll(".iso-shore-rim").length, 4);
      assert.equal(exposed.querySelectorAll(".iso-river-bank").length, 2);
      for (const bank of exposed.querySelectorAll(".iso-river-bank")) {
        const v = vertices(bank);
        near(v[1].y - v[2].y, 4);
      }
    } else assert.equal(exposed.querySelectorAll(".iso-turf-edge").length, 2);
  }
});
