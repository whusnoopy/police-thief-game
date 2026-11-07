import test from "node:test";
import assert from "node:assert/strict";
import { createTestEnvironment } from "./helpers/fakeDom.js";
import {
  createRampMapDefinition,
  setLegacyTileAt,
} from "../src/domain/map/mapModel.js";
import { createGameSession } from "../src/domain/game/sessionFactory.js";
import { createIsometricScene } from "../src/ui/isometric/sceneModel.js";
import {
  createIsometricProjection,
  projectSurfacePoint,
  unprojectPoint,
} from "../src/ui/isometric/projection.js";
import {
  SCENERY_ASSETS,
  ACTOR_ASSETS,
} from "../src/ui/isometric/assetMetadata.js";
import { getActorLayout } from "../src/ui/isometric/actorLayout.js";
import { renderScenery } from "../src/ui/isometric/sceneryArt.js";
import {
  svgElement,
  polygon,
  line,
} from "../src/ui/isometric/artPrimitives.js";
import { createAlphaSampler } from "../src/ui/isometric/spriteAlpha.js";
import {
  getOccludingRecords,
  hasActualOcclusion,
  pickOccludedActor,
  readOpaqueGeometry,
} from "../src/ui/isometric/occlusionGeometry.js";
import {
  createActorRecord,
  rebuildOcclusion,
  renderActorLabels,
  updateOutlineSelection,
} from "../src/ui/isometric/occlusionLayer.js";

const env = createTestEnvironment();
env.installGlobals();
const projection = createIsometricProjection();
const makeCell = (type, r = 4, c = 4) => {
  const map = createRampMapDefinition();
  setLegacyTileAt(map, r, c, type);
  return {
    map,
    cell: createIsometricScene(createGameSession(map), projection).cells.find(
      (cell) => cell.r === r && cell.c === c,
    ),
  };
};
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function rect(root, x, y, w, h, attributes = {}) {
  return polygon(
    root,
    [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    { fill: "#859b87", ...attributes },
  );
}
function opaque(root, index, cell = { r: 0, c: 0 }) {
  return { maskId: `test-${index}`, index, cell, ...readOpaqueGeometry(root) };
}

test("buildings and barriers have centered foundations and leave every neighboring ground tile partly visible", () => {
  for (const type of Object.keys(SCENERY_ASSETS).filter((t) => t !== "MOUNTAIN"))
    for (const [r, c] of [[0, 0], [4, 4], [9, 9]]) {
      const { map, cell } = makeCell(type, r, c);
      const root = svgElement("g");
      const before = JSON.stringify(map);
      renderScenery(root, cell, projection, map);
      const faces = root.querySelectorAll("polygon");
      const bottom = (type === "BARRIER" ? [0, 1, 3, 4] : [0, 1])
        .flatMap((index) => faces[index].attributes.points.split(" ").slice(0, 2))
        .map((pair) => {
          const [x, y] = pair.split(",").map(Number);
          return unprojectPoint({ x, y }, projection);
        });
      near((Math.min(...bottom.map(p => p.r)) + Math.max(...bottom.map(p => p.r))) / 2, r);
      near((Math.min(...bottom.map(p => p.c)) + Math.max(...bottom.map(p => p.c))) / 2, c);
      const geometry = readOpaqueGeometry(root);
      for (const dr of [-1, 0, 1]) for (const dc of [-1, 0, 1]) {
        if ((!dr && !dc) || r + dr < 0 || r + dr > 9 || c + dc < 0 || c + dc > 9) continue;
        const samples = [-.45, -.225, 0, .225, .45].flatMap(rr =>
          [-.45, -.225, 0, .225, .45].map(cc => projectSurfacePoint(
            { r: r + dr, c: c + dc, tileType: "ROAD" }, rr, cc, projection,
          )),
        );
        assert.ok(samples.some(p => !geometry.contains(p)), `${type} fully covers neighbor ${dr},${dc}`);
      }
      assert.equal(JSON.stringify(map), before);
    }
});

test("facility people use the transformed door while vehicles use a separate larger driveway marker, without changing positions", () => {
  for (const type of ["BANK", "POLICE_STATION", "THIEF_BASE", "FARM"]) {
    const { cell } = makeCell(type);
    const unit = {
      id: "T1",
      r: 4,
      c: 4,
      state: "ACTIVE",
      hasMoney: true,
      inCar: false,
    };
    const object = { ...cell, kind: "unit", side: "thief", unit };
    const before = JSON.stringify(object);
    const onFoot = getActorLayout(object, projection),
      car = getActorLayout(
        { ...object, unit: { ...unit, inCar: true } },
        projection,
      );
    const a = SCENERY_ASSETS[type],
      t = a.display;
    const expected = projectSurfacePoint(
      cell,
      a.door.r * t.scaleR + t.offsetR,
      a.door.c * t.scaleC + t.offsetC,
      projection,
    );
    near(onFoot.foot.x, expected.x);
    near(onFoot.foot.y, expected.y);
    assert.equal(onFoot.placement, "doorway");
    assert.equal(car.placement, "driveway");
    assert.ok(onFoot.scale < car.scale && car.scale >= 0.7);
    assert.notDeepEqual(onFoot.foot, car.foot);
    assert.equal(JSON.stringify(object), before);
  }
  for (const type of ["ROAD", "GRASS", "RIVER", "OVERPASS_RAMP_E"]) {
    const { cell } = makeCell(type);
    for (const [side, unit] of [
      ["thief", { inCar: false }],
      ["police", { inCar: true }],
      ["animal", { emoji: "🐮" }],
    ]) {
      const layout = getActorLayout(
        { ...cell, kind: "unit", side, unit },
        projection,
      );
      assert.equal(layout.scale, 0.86);
      assert.deepEqual(layout.foot, cell.anchor);
      assert.equal(
        layout.width,
        ACTOR_ASSETS[layout.vehicle ? "vehicle" : layout.name].width * 0.86,
      );
    }
  }
});

test("source alpha excludes transparent image corners and uses the actual silhouette for partial and full occlusion", () => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 1; y < 7; y++)
    for (let x = 2; x < 6; x++) pixels[(y * 8 + x) * 4 + 3] = 255;
  pixels[3] = 64; // A faint baked shadow is not part of the actor body.
  const alpha = createAlphaSampler(8, 8, pixels);
  const actor = {
    index: 0,
    cell: { r: 2, c: 3 },
    bounds: { x: 0, y: 0, width: 8, height: 8 },
    contains: (p) => alpha(p.x / 8, p.y / 8),
  };
  assert.equal(alpha(0, 0), false);
  assert.equal(alpha(0.5, 0.5), true);
  assert.equal(alpha(1, 1), false);
  const corner = svgElement("g");
  rect(corner, 0, 0, 1.5, 8);
  const partial = svgElement("g");
  rect(partial, 3, 0, 5, 8);
  const full = svgElement("g");
  rect(full, 0, 0, 8, 8);
  assert.equal(hasActualOcclusion(actor, [opaque(corner, 1)]), false);
  assert.equal(hasActualOcclusion(actor, [opaque(partial, 1)]), true);
  assert.equal(hasActualOcclusion(actor, [opaque(full, 1)]), true);
  actor.occluders = [opaque(partial, 1)];
  actor.occluded = true;
  assert.equal(pickOccludedActor({ x: 4, y: 4 }, [actor]), actor.cell);
  assert.equal(
    pickOccludedActor({ x: 2.5, y: 4 }, [actor]),
    null,
    "visible pixels keep their normal hit target",
  );
  assert.equal(
    pickOccludedActor({ x: 0.5, y: 4 }, [actor]),
    null,
    "transparent corners never proxy a unit",
  );
  assert.equal(
    getOccludingRecords(actor, [opaque(full, -1)]).length,
    0,
    "objects behind the actor cannot occlude it",
  );
});

test("vector holes, sparse construction beams and bridge rail gaps remain transparent and shadows never occlude", () => {
  const root = svgElement("g");
  rect(root, 0, 0, 2, 10);
  rect(root, 8, 0, 2, 10);
  line(
    root,
    { x: 0, y: 4 },
    { x: 10, y: 4 },
    { stroke: "#657f7c", "stroke-width": 1 },
  );
  rect(root, 0, 0, 10, 10, { class: "iso-vehicle-shadow" });
  const geo = readOpaqueGeometry(root);
  assert.equal(geo.contains({ x: 5, y: 7 }), false);
  assert.equal(geo.contains({ x: 5, y: 4.3 }), true);
  assert.equal(geo.contains({ x: 1, y: 7 }), true);
  const actor = {
    index: 0,
    bounds: { x: 4, y: 6, width: 2, height: 2 },
    contains: () => true,
  };
  assert.equal(hasActualOcclusion(actor, [{ ...geo, index: 1 }]), false);
});

test("masks reference only later opaque art and outlines do not merge the full source or include actor shadows", () => {
  const { cell } = makeCell("ROAD");
  const object = {
    ...cell,
    kind: "unit",
    side: "thief",
    direction: "S",
    unit: { id: "T1", inCar: true },
  };
  const defs = svgElement("defs"),
    layer = svgElement("g");
  const actor = createActorRecord(
    defs,
    object,
    getActorLayout(object, projection),
    projection,
    "actor",
    1,
    () => {},
  );
  const front = svgElement("g");
  rect(
    front,
    actor.bounds.x,
    actor.bounds.y,
    actor.bounds.width,
    actor.bounds.height,
  );
  const occluder = opaque(front, 2);
  rebuildOcclusion(defs, layer, [actor], [actor, occluder], null);
  assert.equal(actor.occluded, true);
  assert.equal(actor.body.querySelectorAll(".iso-vehicle-shadow").length, 0);
  assert.equal(actor.mask.querySelectorAll("use").length, 1);
  assert.equal(
    actor.mask.querySelectorAll("use")[0].attributes.href,
    "#test-2",
  );
  assert.deepEqual(
    actor.stroke.filter
      .querySelectorAll("feMergeNode")
      .map((e) => e.attributes.in),
    ["halo", "stroke"],
  );
  assert.equal(actor.outline.attributes["pointer-events"], "none");
  updateOutlineSelection([actor], object);
  assert.equal(actor.outline.classList.contains("selected"), true);
  assert.equal(actor.stroke.color.attributes["flood-color"], "#e8a01d");
  actor.unsubscribe();
});

test("foreground labels retain money/escort, avoid overlaps and bind to original cells despite doorway scaling", () => {
  const { cell } = makeCell("BANK");
  const defs = svgElement("defs"),
    layer = svgElement("g");
  const units = [
    { id: "T1", hasMoney: true, state: "ACTIVE" },
    { id: "P1", state: "CARRYING" },
  ];
  const actors = units.map((unit, index) => {
    const object = {
      ...cell,
      kind: "unit",
      side: index ? "police" : "thief",
      unit,
    };
    return createActorRecord(
      defs,
      object,
      getActorLayout(object, projection),
      projection,
      unit.id,
      index,
      () => {},
    );
  });
  const targets = [];
  renderActorLabels(
    layer,
    actors,
    projection,
    cell,
    new Set(["4,4"]),
    (label, target) => targets.push([label, target]),
  );
  assert.equal(layer.querySelectorAll(".money").length, 1);
  assert.equal(layer.querySelectorAll(".escort").length, 1);
  assert.equal(targets.length, 2);
  targets.forEach(([label, target]) => {
    assert.equal(target.r, 4);
    assert.equal(target.c, 4);
    assert.equal(label.attributes.role, "button");
  });
  const rects = layer
    .querySelectorAll(".iso-actor-label")
    .map((g) => g.querySelectorAll("rect")[0]);
  assert.notEqual(rects[0].attributes.y, rects[1].attributes.y);
  actors.forEach((actor) => actor.unsubscribe());
});
