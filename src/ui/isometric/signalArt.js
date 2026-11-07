import { SIGNAL_PHASES, normalizeSignalPhase } from "../../config/constants.js";
import { getCrosswalkOrientation } from "../../domain/map/crosswalk.js";
import { createPainter, svgElement } from "./artPrimitives.js";

// Both heads face across the crossing, toward pedestrians at the opposite end.
export function getCrosswalkSignalSpecs(tileType) {
  const orientation = getCrosswalkOrientation(tileType);
  if (!orientation) return [];
  const horizontal = orientation === "HORIZONTAL";
  return [-1, 1].map((sign) => ({
    localR: horizontal ? 0.39 : sign * 0.44,
    localC: horizontal ? sign * 0.44 : 0.39,
    dr: horizontal ? 0 : -sign,
    dc: horizontal ? -sign : 0,
    direction: horizontal ? (sign < 0 ? "E" : "W") : sign < 0 ? "S" : "N",
  }));
}

export function renderCrosswalkSignal(parent, cell, projection, signalPhase) {
  const { localR, localC, dr, dc, direction } = cell.signal;
  const green =
    normalizeSignalPhase(signalPhase) === SIGNAL_PHASES.PEDESTRIAN_GREEN;
  const frontVisible = dr + dc > 0;
  const group = svgElement("g", {
    class: `iso-crosswalk-signal ${green ? "green" : "red"}`,
    "data-facing": direction,
    "data-face": frontVisible ? "front" : "back",
    "aria-label": `过街信号灯，${green ? "行人绿灯" : "行人红灯"}`,
  });
  group.appendChild(
    svgElement("title", {}, `过街信号灯：${green ? "行人绿灯" : "行人红灯"}`),
  );
  parent.appendChild(group);
  const p = createPainter(group, cell, projection);
  const local = (f, s, h) => [
    localR + dr * f - dc * s,
    localC + dc * f + dr * s,
    h,
  ];
  const face = (vertices, fill, attributes = {}) =>
    p.face(
      vertices.map(([f, s, h]) => local(f, s, h)),
      fill,
      { "stroke-width": 0.45, ...attributes },
    );
  p.box(
    localR - 0.045,
    localC - 0.045,
    localR + 0.045,
    localC + 0.045,
    0,
    1.7,
    { front: "#b7bfa9", side: "#919f92", top: "#e2dfc4" },
    { "stroke-width": 0.45 },
  );
  p.edge([localR, localC, 1.7], [localR, localC, 25], {
    stroke: "#607c78",
    "stroke-width": 2,
    class: "iso-signal-pole",
  });
  p.edge(
    [localR - 0.009, localC - 0.009, 2.4],
    [localR - 0.009, localC - 0.009, 24],
    { stroke: "#c3ceba", "stroke-width": 0.55 },
  );
  const corners = [local(-0.035, -0.085, 0), local(0.035, 0.085, 0)];
  p.box(
    Math.min(corners[0][0], corners[1][0]),
    Math.min(corners[0][1], corners[1][1]),
    Math.max(corners[0][0], corners[1][0]),
    Math.max(corners[0][1], corners[1][1]),
    21,
    35,
    { front: "#687e76", side: "#4d6561", top: "#a4b2a0" },
    { "stroke-width": 0.6 },
  );
  if (frontVisible) {
    face(
      [
        [0.038, -0.07, 22],
        [0.038, 0.07, 22],
        [0.038, 0.07, 34],
        [0.038, -0.07, 34],
      ],
      "#314e4e",
    );
    for (const [h, isActive, color] of [
      [31, !green, "#d37a67"],
      [25.5, green, "#55ae7a"],
    ]) {
      const ring = Array.from({ length: 16 }, (_, i) => [
        0.041,
        Math.cos((i * Math.PI) / 8) * 0.05,
        h + Math.sin((i * Math.PI) / 8) * 2.05,
      ]);
      face(ring, isActive ? color : "#4b6260", {
        stroke: isActive ? "#e6e2bc" : "#7d9183",
        "stroke-width": 0.4,
        class: `iso-signal-lens${isActive ? " lit" : ""}`,
      });
      // A short hood projects in the head's actual facing direction.
      face(
        [
          [0.039, -0.07, h + 2.5],
          [0.039, 0.07, h + 2.5],
          [0.095, 0.07, h + 2.5],
          [0.095, -0.07, h + 2.5],
        ],
        "#7e9385",
      );
    }
  } else {
    face(
      [
        [-0.038, -0.063, 22.5],
        [-0.038, 0.063, 22.5],
        [-0.038, 0.063, 33.5],
        [-0.038, -0.063, 33.5],
      ],
      "#73877c",
    );
    p.strokes(
      [
        [-0.045, 0.045].map((s) => local(-0.04, s, 32)),
        [-0.045, 0.045].map((s) => local(-0.04, s, 24)),
      ],
      { stroke: "#aab6a2", "stroke-width": 0.6 },
    );
  }
  return group;
}
