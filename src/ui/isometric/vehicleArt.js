import { BRIDGE_DIRECTIONS } from "../../domain/map/bridgeTopology.js";
import { createPainter, svgElement } from "./artPrimitives.js";

// Each direction is projected from a fresh mesh; neither light nor shadow rotates.
export function appendVehicleArtwork(
  container,
  cell,
  projection,
  direction = "S",
  police = false,
) {
  const svg = svgElement("svg", {
    viewBox: `${cell.anchor.x - 38} ${cell.anchor.y - 50} 76 76`,
    class: "story-sprite unit-art iso-vehicle-art",
    "data-direction": direction,
    "aria-hidden": "true",
  });
  container.appendChild(svg);
  const p = createPainter(svg, cell, projection);
  const { dr, dc } =
    BRIDGE_DIRECTIONS.find((item) => item.direction === direction) ||
    BRIDGE_DIRECTIONS[2];
  const local = (f, s, h = 0) => [dr * f - dc * s, dc * f + dr * s, h];
  const face = (vertices, fill, attributes = {}) =>
    p.face(
      vertices.map(([f, s, h]) => local(f, s, h)),
      fill,
      attributes,
    );
  const seams = (segments, attributes = {}) =>
    p.strokes(
      segments.map((vertices) => vertices.map(([f, s, h]) => local(f, s, h))),
      attributes,
    );
  const visible = (f, s) => dr * f - dc * s + (dc * f + dr * s) > 0;
  const color = police
    ? { front: "#dce4dc", side: "#a7c1c1", top: "#f1ecda" }
    : { front: "#dda76e", side: "#b87d5d", top: "#f1c98b" };
  const shade = (f, s) => (dr * f - dc * s > 0 ? color.front : color.side);
  const wheel = (f, s) => {
    const ring = Array.from({ length: 12 }, (_, i) => {
      const angle = (i * Math.PI) / 6;
      return local(f + Math.cos(angle) * 0.085, s, 5.8 + Math.sin(angle) * 5.4);
    });
    p.face(ring, "#445559", { "stroke-width": 0.9, class: "iso-car-wheel" });
    const hub = Array.from({ length: 10 }, (_, i) => {
      const angle = (i * Math.PI) / 5;
      return local(f + Math.cos(angle) * 0.039, s, 5.8 + Math.sin(angle) * 2.6);
    });
    p.face(hub, "#c6d1c5", { stroke: "#78918f", "stroke-width": 0.5 });
    seams(
      Array.from({ length: 3 }, (_, i) => {
        const angle = (i * Math.PI) / 3;
        return [
          [f - Math.cos(angle) * 0.027, s, 5.8 - Math.sin(angle) * 1.8],
          [f + Math.cos(angle) * 0.027, s, 5.8 + Math.sin(angle) * 1.8],
        ];
      }),
      { stroke: "#7c918e", "stroke-width": 0.45 },
    );
    seams(
      [
        [
          [f - 0.062, s, 8],
          [f - 0.04, s, 9.4],
          [f + 0.025, s, 10],
        ],
      ],
      { stroke: "#83958c", "stroke-width": 0.6 },
    );
  };
  face(
    [
      [-0.44, -0.26, 0],
      [-0.44, 0.26, 0],
      [0.44, 0.26, 0],
      [0.44, -0.26, 0],
    ],
    "#4b655c",
    { opacity: 0.18, stroke: "none", class: "iso-vehicle-shadow" },
  );
  for (const s of [-0.23, 0.23])
    if (!visible(0, s)) for (const f of [-0.26, 0.27]) wheel(f, s);
  for (const f of [-0.43, 0.43])
    if (visible(f, 0)) {
      face(
        [
          [f, -0.22, 6],
          [f, 0.22, 6],
          [f, 0.22, 14],
          [f, -0.22, 14],
        ],
        shade(f, 0),
      );
      for (const s of [-0.15, 0.15])
        face(
          [
            [f, s - 0.047, 9],
            [f, s + 0.047, 9],
            [f, s + 0.047, 12],
            [f, s - 0.047, 12],
          ],
          f > 0 ? "#fff0ba" : "#cb7662",
          { "stroke-width": 0.4 },
        );
      face(
        [
          [f, -0.08, 7],
          [f, 0.08, 7],
          [f, 0.08, 9],
          [f, -0.08, 9],
        ],
        "#617574",
        { "stroke-width": 0.3 },
      );
      face(
        [
          [f, -0.21, 6.5],
          [f, 0.21, 6.5],
          [f, 0.21, 7.5],
          [f, -0.21, 7.5],
        ],
        "#b8c4b8",
        { "stroke-width": 0.3 },
      );
      face(
        [
          [f, -0.035, 7.6],
          [f, 0.035, 7.6],
          [f, 0.035, 9.1],
          [f, -0.035, 9.1],
        ],
        "#eee6c9",
        { "stroke-width": 0.25 },
      );
      seams(
        [
          ...[-0.15, 0.15].map((s) => [
            [f, s - 0.035, 11.2],
            [f, s + 0.03, 11.2],
          ]),
          [
            [f, -0.19, 13.1],
            [f, 0.19, 13.1],
          ],
        ],
        { stroke: "#fff1cc", "stroke-width": 0.55 },
      );
    }
  for (const s of [-0.22, 0.22])
    if (visible(0, s)) {
      face(
        [
          [-0.43, s, 6],
          [0.43, s, 6],
          [0.43, s, 14],
          [-0.43, s, 14],
        ],
        shade(0, s),
      );
      face(
        [
          [-0.38, s, 9],
          [0.36, s, 9],
          [0.36, s, 12],
          [-0.38, s, 12],
        ],
        police ? "#5a8ba7" : "#cb925f",
        { stroke: "none" },
      );
    }
  face(
    [
      [-0.43, -0.22, 14],
      [-0.43, 0.22, 14],
      [0.43, 0.22, 14],
      [0.43, -0.22, 14],
    ],
    color.top,
  );
  seams(
    [
      [
        [0.27, -0.18, 14.1],
        [0.39, -0.18, 14.1],
        [0.39, 0.18, 14.1],
        [0.27, 0.18, 14.1],
      ],
      [
        [-0.39, -0.18, 14.1],
        [-0.39, 0.18, 14.1],
      ],
    ],
    { stroke: "#b2a487", "stroke-width": 0.4 },
  );
  if (visible(-1, 0)) {
    face(
      [
        [-0.34, -0.2, 14],
        [-0.34, 0.2, 14],
        [-0.22, 0.16, 26],
        [-0.22, -0.16, 26],
      ],
      "#6d99a4",
    );
    face(
      [
        [-0.31, -0.13, 17],
        [-0.25, -0.13, 23],
        [-0.25, 0.1, 23],
      ],
      "#c6ded4",
      { stroke: "none", opacity: 0.6 },
    );
    seams(
      [
        [
          [-0.32, -0.17, 15.5],
          [-0.32, 0.17, 15.5],
        ],
      ],
      { stroke: "#d6ded0", "stroke-width": 0.65 },
    );
  }
  for (const s of [-1, 1])
    if (visible(0, s)) {
      face(
        [
          [-0.34, s * 0.2, 14],
          [0.22, s * 0.2, 14],
          [0.08, s * 0.16, 26],
          [-0.22, s * 0.16, 26],
        ],
        color.front,
      );
      face(
        [
          [-0.28, s * 0.204, 15.5],
          [-0.045, s * 0.204, 15.5],
          [-0.045, s * 0.164, 24],
          [-0.2, s * 0.164, 24],
        ],
        "#739eab",
      );
      face(
        [
          [-0.015, s * 0.204, 15.5],
          [0.15, s * 0.204, 15.5],
          [0.065, s * 0.164, 24],
          [-0.015, s * 0.164, 24],
        ],
        "#93b6ba",
      );
      face(
        [
          [-0.25, s * 0.201, 17],
          [-0.19, s * 0.17, 23],
          [-0.08, s * 0.17, 23],
        ],
        "#cfdfd6",
        { stroke: "none", opacity: 0.7 },
      );
      face(
        [
          [0.02, s * 0.199, 17],
          [0.02, s * 0.17, 23],
          [0.06, s * 0.17, 23],
        ],
        "#d6e5da",
        { stroke: "none", opacity: 0.8 },
      );
      seams(
        [
          [
            [-0.27, s * 0.222, 12.8],
            [-0.2, s * 0.222, 12.8],
          ],
          [
            [0.025, s * 0.222, 12.8],
            [0.09, s * 0.222, 12.8],
          ],
          [
            [-0.35, s * 0.222, 7],
            [0.16, s * 0.222, 7],
          ],
        ],
        { stroke: "#f5e5c6", "stroke-width": 0.7 },
      );
      if (police)
        face(
          [
            [-0.2, s * 0.223, 11.3],
            [-0.12, s * 0.223, 11.3],
            [-0.13, s * 0.223, 9.4],
            [-0.16, s * 0.223, 8.6],
            [-0.19, s * 0.223, 9.4],
          ],
          "#e2c77e",
          { "stroke-width": 0.3 },
        );
      p.edge(local(-0.03, s * 0.224, 6), local(-0.03, s * 0.224, 14), {
        stroke: "#8d8873",
        "stroke-width": 0.5,
      });
    }
  if (visible(1, 0)) {
    face(
      [
        [0.22, -0.2, 14],
        [0.22, 0.2, 14],
        [0.08, 0.16, 26],
        [0.08, -0.16, 26],
      ],
      "#7aabb4",
    );
    face(
      [
        [0.105, -0.13, 24],
        [0.105, 0.12, 24],
        [0.177, -0.15, 17.8],
      ],
      "#cae1d7",
      { stroke: "none", opacity: 0.7 },
    );
    seams(
      [
        [
          [0.205, -0.16, 15.5],
          [0.205, 0.16, 15.5],
        ],
        [
          [0.202, -0.13, 15.9],
          [0.161, -0.03, 19.4],
        ],
        [
          [0.202, 0.025, 15.9],
          [0.161, 0.125, 19.4],
        ],
      ],
      { stroke: "#567783", "stroke-width": 0.5 },
    );
  }
  face(
    [
      [-0.22, -0.16, 26],
      [-0.22, 0.16, 26],
      [0.08, 0.16, 26],
      [0.08, -0.16, 26],
    ],
    police ? "#789ca9" : "#f0c386",
  );
  seams(
    [
      [
        [-0.19, -0.135, 26.1],
        [-0.19, 0.135, 26.1],
        [0.045, 0.135, 26.1],
      ],
    ],
    { stroke: "#f5e8c9", "stroke-width": 0.55 },
  );
  if (police)
    for (const [s, fill] of [
      [-0.1, "#c97465"],
      [0.1, "#6396b8"],
    ]) {
      face(
        [
          [-0.1, s - 0.055, 27],
          [-0.1, s + 0.055, 27],
          [0.0, s + 0.055, 30],
          [0.0, s - 0.055, 30],
        ],
        fill,
      );
      face(
        [
          [-0.1, s - 0.055, 30],
          [-0.1, s + 0.055, 30],
          [0.0, s + 0.055, 30],
          [0.0, s - 0.055, 30],
        ],
        "#e8d8af",
      );
    }
  for (const s of [-0.235, 0.235])
    if (visible(0, s)) for (const f of [-0.26, 0.27]) wheel(f, s);
  return svg;
}
