import "../../src/styles/index.css";
import { TILE_TYPES } from "../../src/config/constants.js";
import {
  BRIDGE_DIRECTIONS,
  isBridgeTileType,
} from "../../src/domain/map/bridgeTopology.js";
import {
  createRampMapDefinition,
  setLegacyTileAt,
} from "../../src/domain/map/mapModel.js";
import { createGameSession } from "../../src/domain/game/sessionFactory.js";
import { createIsometricProjection } from "../../src/ui/isometric/projection.js";
import { createIsometricScene } from "../../src/ui/isometric/sceneModel.js";
import { svgElement } from "../../src/ui/isometric/artPrimitives.js";
import { SCENERY_ASSETS } from "../../src/ui/isometric/assetMetadata.js";
import { ACTOR_ASSETS } from "../../src/ui/isometric/assetMetadata.js";
import { appendSprite } from "../../src/ui/board/storybookArt.js";
import {
  renderGround,
  renderBridgeDeck,
  renderBridgeRails,
  renderBridgeShadow,
} from "../../src/ui/isometric/terrainArt.js";
import {
  renderScenery,
  renderSceneryShadow,
} from "../../src/ui/isometric/sceneryArt.js";
import { appendVehicleArtwork } from "../../src/ui/isometric/vehicleArt.js";
import { renderCrosswalkSignal } from "../../src/ui/isometric/signalArt.js";

const projection = createIsometricProjection();
const center = { r: 4, c: 4 };

function card(section, label, id) {
  const figure = document.createElement("figure");
  figure.className = "art-card";
  figure.id = id;
  const preview = document.createElement("div");
  preview.className = "art-preview";
  const caption = document.createElement("figcaption");
  caption.textContent = label;
  figure.append(preview, caption);
  document.getElementById(section).appendChild(figure);
  return preview;
}

function context(
  preview,
  map,
  vehicle = null,
  signalPhase = "PEDESTRIAN_GREEN",
) {
  const scene = createIsometricScene(createGameSession(map), projection);
  const cell = scene.cells.find(({ r, c }) => r === center.r && c === center.c);
  const compact = SCENERY_ASSETS[cell.tileType] && cell.tileType !== "MOUNTAIN";
  const viewBox = compact
    ? `${cell.anchor.x - 75} ${cell.anchor.y - 100} 150 135`
    : `${cell.anchor.x - 130} ${cell.anchor.y - 115} 260 200`;
  const svg = svgElement("svg", { viewBox, "aria-label": "斜视素材预览" });
  preview.appendChild(svg);
  const cells = scene.cells.filter(
    ({ r, c }) => Math.abs(r - center.r) <= 1 && Math.abs(c - center.c) <= 1,
  );
  for (const current of cells)
    if (!isBridgeTileType(current.tileType))
      renderGround(svg, current, projection, {
        mapDefinition: map,
        signalPhase,
      });
  const objects = scene.objects.filter(
    ({ r, c }) => Math.abs(r - center.r) <= 1 && Math.abs(c - center.c) <= 1,
  );
  for (const current of objects) {
    if (current.kind === "scenery")
      renderSceneryShadow(svg, current, projection);
    if (current.kind === "bridge") renderBridgeShadow(svg, current, projection);
  }
  for (const current of objects) {
    if (current.kind === "signal")
      renderCrosswalkSignal(svg, current, projection, signalPhase);
    if (current.kind === "bridge") {
      renderBridgeDeck(svg, current, projection, map);
      if (vehicle && current.r === center.r && current.c === center.c) {
        const image = appendVehicleArtwork(
          svg,
          current,
          projection,
          vehicle.direction,
          vehicle.police,
        );
        for (const [name, value] of Object.entries({
          x: current.anchor.x - 38,
          y: current.anchor.y - 50,
          width: 76,
          height: 76,
        }))
          image.setAttribute(name, value);
        image.style.width = "76px";
        image.style.height = "76px";
      }
    }
    if (current.kind === "bridge-front")
      renderBridgeRails(svg, current, projection, map, true);
    if (current.kind === "scenery")
      renderScenery(svg, current, projection, map);
  }
  return cell;
}

for (const kind of ["GRASS", "RIVER"]) {
  const map = createRampMapDefinition();
  for (const [r, c] of [
    [4, 4],
    [4, 5],
    [5, 4],
    [5, 5],
  ])
    setLegacyTileAt(map, r, c, kind);
  if (kind === "RIVER") setLegacyTileAt(map, 3, 4, "GRASS");
  context(
    card(
      "terrain-gallery",
      kind === "GRASS" ? "草坪：薄土层与草簇" : "水体：下沉水面与岸壁",
      `terrain-${kind}`,
    ),
    map,
  );
}
for (const kind of ["CROSSWALK_HORIZONTAL", "CROSSWALK_VERTICAL"]) {
  for (const phase of ["PEDESTRIAN_GREEN", "PEDESTRIAN_RED"]) {
    const map = createRampMapDefinition();
    setLegacyTileAt(map, 4, 4, kind);
    context(
      card(
        "terrain-gallery",
        `${TILE_TYPES[kind].name} · ${phase === "PEDESTRIAN_GREEN" ? "行人绿灯" : "行人红灯"}`,
        `terrain-${kind}-${phase}`,
      ),
      map,
      null,
      phase,
    );
  }
}

for (const kind of Object.keys(SCENERY_ASSETS)) {
  const map = createRampMapDefinition();
  setLegacyTileAt(map, 4, 4, kind);
  if (kind === "MOUNTAIN") setLegacyTileAt(map, 4, 5, kind);
  context(
    card("scenery-gallery", TILE_TYPES[kind].name, `scenery-${kind}`),
    map,
  );
}
for (const [name, label] of [
  ["police", "警察"],
  ["thief", "小偷"],
  ["pig", "猪"],
  ["cow", "牛"],
]) {
  const map = createRampMapDefinition(),
    scene = createIsometricScene(createGameSession(map), projection);
  const cell = scene.cells.find(({ r, c }) => r === 4 && c === 4),
    asset = ACTOR_ASSETS[name];
  const svg = svgElement("svg", {
    viewBox: `${cell.anchor.x - 75} ${cell.anchor.y - 100} 150 135`,
  });
  card("actor-gallery", label, `actor-${name}`).appendChild(svg);
  renderGround(svg, cell, projection, {
    mapDefinition: map,
    signalPhase: "PEDESTRIAN_GREEN",
  });
  const image = svgElement("foreignObject", {
    x: cell.anchor.x - asset.width / 2,
    y: cell.anchor.y - asset.height * asset.foot,
    width: asset.width,
    height: asset.height,
  });
  const content = document.createElement("div");
  content.className = "iso-billboard";
  image.appendChild(content);
  svg.appendChild(image);
  appendSprite(content, name, "unit-art", label, {
    url: new URL(`../../src/assets/isometric/${name}.webp`, import.meta.url)
      .href,
  });
}
for (let mask = 0; mask < 16; mask += 1) {
  const map = createRampMapDefinition();
  setLegacyTileAt(map, 4, 4, "OVERPASS");
  for (const [index, d] of BRIDGE_DIRECTIONS.entries())
    if (mask & (1 << index))
      setLegacyTileAt(map, 4 + d.dr, 4 + d.dc, "OVERPASS");
  const directions =
    BRIDGE_DIRECTIONS.filter((_, i) => mask & (1 << i))
      .map((d) => d.direction)
      .join(" · ") || "孤立";
  context(
    card(
      "bridge-gallery",
      `${mask.toString(2).padStart(4, "0")} — ${directions}`,
      `bridge-mask-${mask}`,
    ),
    map,
    { direction: "S", police: false },
  );
}
for (const d of BRIDGE_DIRECTIONS) {
  const map = createRampMapDefinition();
  setLegacyTileAt(map, 4, 4, `OVERPASS_RAMP_${d.direction}`);
  setLegacyTileAt(map, 4 + d.dr, 4 + d.dc, "OVERPASS");
  context(
    card("ramp-gallery", `向${d.name}上桥，反向下桥`, `ramp-${d.direction}`),
    map,
    { direction: d.direction, police: true },
  );
}
for (const police of [false, true])
  for (const d of BRIDGE_DIRECTIONS) {
    const map = createRampMapDefinition();
    const scene = createIsometricScene(createGameSession(map), projection);
    const cell = scene.cells.find(({ r, c }) => r === 4 && c === 4);
    appendVehicleArtwork(
      card(
        "vehicle-gallery",
        `${police ? "警车" : "汽车"} · 向${d.name}`,
        `vehicle-${police ? "police" : "car"}-${d.direction}`,
      ),
      cell,
      projection,
      d.direction,
      police,
    );
  }
