import { TILE_TYPES } from "../../config/constants.js";
import {
  BRIDGE_DIRECTIONS,
  getBridgeConnectionMask,
  getRampDirection,
  isBridgeTileType,
} from "../../domain/map/bridgeTopology.js";
import {
  getCrosswalkOrientation,
  isCrosswalkTileType,
} from "../../domain/map/crosswalk.js";
import { createPainter, polygon, svgElement } from "./artPrimitives.js";
import { projectPoint, surfaceHeightAt } from "./projection.js";

export const BRIDGE_EDGES = Object.freeze([
  { direction: "N", from: [-0.5, -0.5], to: [-0.5, 0.5], front: false },
  { direction: "E", from: [-0.5, 0.5], to: [0.5, 0.5], front: true },
  { direction: "S", from: [0.5, 0.5], to: [0.5, -0.5], front: true },
  { direction: "W", from: [0.5, -0.5], to: [-0.5, -0.5], front: false },
]);
const ROAD_TYPES = new Set([
  "ROAD",
  "CROSSWALK",
  "CROSSWALK_HORIZONTAL",
  "CROSSWALK_VERTICAL",
]);
const COLORS = {
  ROAD: "#dcd9c6",
  GRASS: "#b5c99f",
  RIVER: "#8cbfc6",
  MOUNTAIN: "#b7c8a0",
  PARKING: "#d1d2bb",
};

export function getBridgeArtSpec(map, r, c) {
  const mask = getBridgeConnectionMask(map, r, c);
  return {
    mask,
    closedEdges: BRIDGE_EDGES.filter((edge, index) => !(mask & (1 << index))),
  };
}

function surfaceGroup(parent, cell) {
  const group = svgElement("g", {
    class: "iso-surface",
    "data-r": cell.r,
    "data-c": cell.c,
  });
  group.appendChild(
    svgElement(
      "title",
      {},
      `第 ${cell.r + 1} 行 ${cell.c + 1} 列，${TILE_TYPES[cell.tileType].name}`,
    ),
  );
  parent.appendChild(group);
  return group;
}

export function renderGround(parent, cell, projection, session) {
  const group = surfaceGroup(parent, cell),
    p = createPainter(group, cell, projection);
  const type = cell.tileType,
    map = session.mapDefinition;
  const neighbor = (dr, dc) => map.terrain[cell.r + dr]?.[cell.c + dc];
  if (type === "GRASS") {
    // Only exposed front edges have a soil lip; adjoining lawns form one surface.
    for (const edge of BRIDGE_EDGES.filter((edge) => edge.front)) {
      const { dr, dc } = BRIDGE_DIRECTIONS.find(
        (d) => d.direction === edge.direction,
      );
      const adjacent = neighbor(dr, dc);
      if (adjacent === "GRASS" || adjacent === "RIVER") continue;
      const depth = -surfaceHeightAt("GRASS") * projection.bridgeHeight;
      p.face(
        [
          [...edge.from, depth],
          [...edge.to, depth],
          [...edge.to, 0],
          [...edge.from, 0],
        ],
        edge.direction === "S" ? "#8fa17a" : "#788f70",
        {
          stroke: "#7f946f",
          "stroke-width": 0.4,
          class: "iso-turf-edge",
          "data-edge": edge.direction,
        },
      );
    }
  }
  polygon(group, cell.polygon, {
    fill: COLORS[type] || COLORS.ROAD,
    stroke: ["GRASS", "RIVER"].includes(type) ? "none" : "#68795838",
    "stroke-width": 0.6,
    class: "iso-ground-face",
  });
  if (type === "GRASS") {
    const blades = [],
      highlights = [];
    for (let i = 0; i < 7; i += 1) {
      const r = -0.32 + ((cell.r * 7 + cell.c * 3 + i * 11) % 64) / 100,
        c = -0.32 + ((cell.c * 13 + cell.r * 3 + i * 17) % 64) / 100;
      blades.push([
        [r - 0.045, c - 0.02, 2.3],
        [r, c, 0],
        [r + 0.025, c + 0.015, 3.6],
      ]);
      highlights.push([
        [r, c, 0.1],
        [r + 0.045, c + 0.035, 1.8],
      ]);
    }
    p.strokes(blades, {
      stroke: "#7f9e70",
      "stroke-width": 0.8,
      class: "iso-grass-blades",
    });
    p.strokes(highlights, { stroke: "#dce5bc", "stroke-width": 0.65 });
  } else if (type === "RIVER") {
    for (const edge of BRIDGE_EDGES) {
      const { dr, dc } = BRIDGE_DIRECTIONS.find(
        (d) => d.direction === edge.direction,
      );
      const adjacent = neighbor(dr, dc);
      if (adjacent === "RIVER") continue;
      // Bridge bodies already have their own side faces down to the land datum.
      const shoreType = isBridgeTileType(adjacent)
        ? "ROAD"
        : adjacent || "ROAD";
      const rise =
        (surfaceHeightAt(shoreType) - surfaceHeightAt("RIVER")) *
        projection.bridgeHeight;
      if (!edge.front) {
        p.face(
          [
            [...edge.from, 0],
            [...edge.to, 0],
            [...edge.to, rise],
            [...edge.from, rise],
          ],
          edge.direction === "N" ? "#a3ab8f" : "#b7b99a",
          {
            stroke: "none",
            class: "iso-river-bank",
            "data-edge": edge.direction,
          },
        );
        p.edge([...edge.from, 0], [...edge.to, 0], {
          stroke: "#699f9f",
          "stroke-width": 0.7,
        });
      }
      p.edge([...edge.from, rise], [...edge.to, rise], {
        stroke: shoreType === "GRASS" ? "#a6bc8c" : "#d1ceb1",
        "stroke-width": 1,
        class: "iso-shore-rim",
        "data-edge": edge.direction,
      });
    }
    p.strokes(
      [
        [
          [-0.24, -0.32, 0],
          [-0.24, -0.12, 0],
        ],
        [
          [-0.24, -0.04, 0],
          [-0.24, 0.3, 0],
        ],
        [
          [0.17, -0.3, 0],
          [0.17, 0.15, 0],
        ],
        [
          [0.22, 0.03, 0],
          [0.22, 0.28, 0],
        ],
      ],
      { stroke: "#c8e4df", "stroke-width": 1.2, "stroke-opacity": 0.85 },
    );
  } else if (ROAD_TYPES.has(cell.terrain)) {
    for (const edge of BRIDGE_EDGES) {
      const { dr, dc } = BRIDGE_DIRECTIONS.find(
        (d) => d.direction === edge.direction,
      );
      const adjacent = neighbor(dr, dc);
      if (adjacent && !ROAD_TYPES.has(adjacent) && !isBridgeTileType(adjacent))
        p.edge([...edge.from, 0], [...edge.to, 0], {
          stroke: "#c4c9b1",
          "stroke-width": 2,
        });
    }
    if (type === "ROAD") {
      const bits = BRIDGE_DIRECTIONS.reduce(
        (mask, { dr, dc }, i) =>
          mask | (ROAD_TYPES.has(neighbor(dr, dc)) ? 1 << i : 0),
        0,
      );
      if (bits === 5 || bits === 10) {
        const d = BRIDGE_DIRECTIONS[bits === 5 ? 0 : 1];
        p.edge([d.dr * -0.45, d.dc * -0.45, 0], [d.dr * 0.45, d.dc * 0.45, 0], {
          stroke: "#f7f0ce",
          "stroke-width": 1.4,
          "stroke-dasharray": "5 5",
        });
      }
    }
  }
  if (isCrosswalkTileType(type)) {
    for (let offset = -0.4; offset < 0.45; offset += 0.2) {
      const corners =
        getCrosswalkOrientation(type) === "HORIZONTAL"
          ? [
              [-0.3, offset],
              [-0.3, offset + 0.1],
              [0.3, offset + 0.1],
              [0.3, offset],
            ]
          : [
              [offset, -0.3],
              [offset, 0.3],
              [offset + 0.1, 0.3],
              [offset + 0.1, -0.3],
            ];
      p.face(
        corners.map(([r, c]) => [r, c, 0]),
        "#fff9e6",
        { stroke: "none" },
      );
    }
  }
  if (type === "MANHOLE") {
    const ring = Array.from({ length: 16 }, (_, i) => [
      Math.cos((i * Math.PI) / 8) * 0.19,
      Math.sin((i * Math.PI) / 8) * 0.19,
      0,
    ]);
    p.face(ring, "#a4b1a1", { stroke: "#6e897e", "stroke-width": 1.2 });
    for (const r of [-0.09, 0, 0.09])
      p.edge([r, -0.13, 0], [r, 0.13, 0], {
        stroke: "#738f83",
        "stroke-width": 0.7,
      });
  }
  const marker = {
    POLICE_SPAWN: "P",
    THIEF_SPAWN: "T",
    TRAFFIC_LIGHT: "●",
  }[type];
  if (marker) {
    const spawn = type === "POLICE_SPAWN" || type === "THIEF_SPAWN";
    const pos = spawn ? p.at(0.26, -0.26, 0) : p.at(0.14, -0.12, 0);
    const mark = svgElement("g", {
      transform: `matrix(1 .5 -1 .5 ${pos.x} ${pos.y})`,
      class: `iso-ground-mark mark-${type}`,
      "aria-hidden": "true",
    });
    if (spawn) mark.appendChild(svgElement("circle", { r: 9, class: "iso-spawn-ring" }));
    mark.appendChild(
      svgElement(
        "text",
        { y: spawn ? 5 : 0, "text-anchor": "middle" },
        marker,
      ),
    );
    group.appendChild(mark);
  }
}

export function renderBridgeShadow(parent, cell, projection) {
  const vertices = cell.polygon.map(({ x, y }) => ({ x: x + 5, y: y + 10 }));
  polygon(parent, vertices, {
    fill: "#50645d",
    opacity: 0.16,
    stroke: "none",
    class: "iso-cast-shadow",
  });
}

export function renderBridgeDeck(parent, cell, projection, map) {
  const group = surfaceGroup(parent, cell),
    p = createPainter(group, cell, projection);
  const spec = getBridgeArtSpec(map, cell.r, cell.c);
  group.setAttribute("data-connection-mask", spec.mask);
  for (const edge of spec.closedEdges.filter((edge) => edge.front)) {
    const a = p.at(...edge.from),
      b = p.at(...edge.to);
    const ga = projectPoint(
      { r: cell.r + edge.from[0], c: cell.c + edge.from[1] },
      projection,
    );
    const gb = projectPoint(
      { r: cell.r + edge.to[0], c: cell.c + edge.to[1] },
      projection,
    );
    polygon(group, [a, b, gb, ga], {
      fill: edge.direction === "S" ? "#b3bdb1" : "#8d9f9a",
      stroke: "#7f948b",
      "stroke-width": 0.6,
    });
  }
  polygon(group, cell.polygon, {
    fill: "#a4b5b2",
    stroke: "#7b918c",
    "stroke-width": 0.7,
  });
  const ramp = getRampDirection(cell.tileType);
  if (ramp) {
    const low = p.at(-ramp.dr * 0.34, -ramp.dc * 0.34),
      high = p.at(ramp.dr * 0.34, ramp.dc * 0.34);
    const angle = Math.atan2(high.y - low.y, high.x - low.x);
    const vertices = [
      { x: high.x, y: high.y },
      {
        x: high.x - 7 * Math.cos(angle - 0.6),
        y: high.y - 7 * Math.sin(angle - 0.6),
      },
      { x: high.x - 4 * Math.cos(angle), y: high.y - 4 * Math.sin(angle) },
      { x: low.x, y: low.y },
    ];
    polygon(group, vertices, {
      fill: "#f4edcb",
      stroke: "#718b85",
      "stroke-width": 0.5,
    });
  } else {
    for (const [index, { dr, dc }] of BRIDGE_DIRECTIONS.entries())
      if (spec.mask & (1 << index))
        p.edge([0, 0, 0], [dr * 0.5, dc * 0.5, 0], {
          stroke: "#e6e8cc",
          "stroke-width": 1.3,
          "stroke-dasharray": "4 4",
        });
  }
  p.strokes(
    spec.closedEdges.map((edge) => [
      edge.from.map((v) => v * 0.92).concat(0.2),
      edge.to.map((v) => v * 0.92).concat(0.2),
    ]),
    { stroke: "#d1d6c0", "stroke-width": 1.5 },
  );
  renderBridgeRails(group, cell, projection, map, false);
}

export function renderBridgeRails(parent, cell, projection, map, front) {
  for (const edge of getBridgeArtSpec(map, cell.r, cell.c).closedEdges.filter(
    (edge) => edge.front === front,
  )) {
    const group = svgElement("g", {
      class: `iso-bridge-rail ${front ? "front" : "rear"}`,
      "data-edge": edge.direction,
    });
    parent.appendChild(group);
    const rail = createPainter(group, cell, projection);
    for (const t of [0.06, 0.5, 0.94]) {
      const r = edge.from[0] + (edge.to[0] - edge.from[0]) * t,
        c = edge.from[1] + (edge.to[1] - edge.from[1]) * t;
      rail.edge([r, c, 0], [r, c, 6], {
        stroke: "#657f7c",
        "stroke-width": 1.8,
      });
    }
    rail.strokes(
      [0.06, 0.5, 0.94].map((t) => {
        const r = edge.from[0] + (edge.to[0] - edge.from[0]) * t;
        const c = edge.from[1] + (edge.to[1] - edge.from[1]) * t;
        return [
          [r, c, 4.4],
          [r, c, 5.3],
        ];
      }),
      { stroke: "#eee4c1", "stroke-width": 1 },
    );
    for (const h of [2.2, 6])
      rail.edge([...edge.from, h], [...edge.to, h], {
        stroke: h === 6 ? "#dfdcc1" : "#7f9790",
        "stroke-width": h === 6 ? 2 : 1.1,
      });
  }
}
