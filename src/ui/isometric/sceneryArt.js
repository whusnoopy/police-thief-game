import { SCENERY_ASSETS } from "./assetMetadata.js";
import { createPainter, polygon } from "./artPrimitives.js";

const STONE = { front: "#ded7ba", side: "#aaa994", top: "#f1e8cd" };
const GLASS = "#78a9b6";
const FINE = { "stroke-width": 0.4 };

function frontPanel(p, r, c0, c1, bottom, top, fill, attributes = {}) {
  return p.face(
    [
      [r, c0, bottom],
      [r, c1, bottom],
      [r, c1, top],
      [r, c0, top],
    ],
    fill,
    attributes,
  );
}
function sidePanel(p, c, r0, r1, bottom, top, fill, attributes = {}) {
  return p.face(
    [
      [r0, c, bottom],
      [r1, c, bottom],
      [r1, c, top],
      [r0, c, top],
    ],
    fill,
    attributes,
  );
}
function roof(p, r, c, wallHeight, peakHeight, color) {
  // A gable on the south façade, with both roof slopes constructed in world space.
  p.face(
    [
      [-r, -c, wallHeight],
      [r, -c, wallHeight],
      [r, 0, peakHeight],
      [-r, 0, peakHeight],
    ],
    "#b7be9f",
  );
  p.face(
    [
      [-r, 0, peakHeight],
      [r, 0, peakHeight],
      [r, c, wallHeight],
      [-r, c, wallHeight],
    ],
    color,
  );
  p.face(
    [
      [r, -c, wallHeight],
      [r, c, wallHeight],
      [r, 0, peakHeight],
    ],
    "#ede0bd",
  );
  const seams = [];
  const onSlope = (rr, t) => [
    rr,
    c * t,
    peakHeight + (wallHeight - peakHeight) * t,
  ];
  for (let row = 1; row <= 5; row += 1) {
    const t = row / 5;
    seams.push([onSlope(-r, t), onSlope(r, t)]);
    for (let col = 1; col < 6; col += 1) {
      const rr = -r + (2 * r * (col - (row % 2) * 0.5)) / 6;
      seams.push([onSlope(rr, (row - 1) / 5), onSlope(rr, t)]);
    }
  }
  p.strokes(seams, {
    stroke: "#526c6a",
    "stroke-opacity": 0.38,
    "stroke-width": 0.45,
  });
  p.strokes(
    [
      [
        [-r, 0, peakHeight],
        [r, 0, peakHeight],
      ],
      [
        [-r, c, wallHeight],
        [r, c, wallHeight],
      ],
      [
        [r, -c, wallHeight],
        [r, 0, peakHeight],
        [r, c, wallHeight],
      ],
    ],
    { stroke: "#f2e4c3", "stroke-width": 1.25 },
  );
  p.strokes(
    [
      [
        [r + 0.002, -c * 0.77, wallHeight + 2],
        [r + 0.002, 0, peakHeight - 4],
        [r + 0.002, c * 0.77, wallHeight + 2],
      ],
      [
        [r + 0.002, -c * 0.77, wallHeight + 2],
        [r + 0.002, c * 0.77, wallHeight + 2],
      ],
    ],
    { stroke: "#b8a987", "stroke-width": 0.65 },
  );
}
function windows(p, asset, wallHeight, floors = 2) {
  const mullions = [];
  for (let row = 0; row < floors; row += 1) {
    const bottom = 10 + (row * (wallHeight - 16)) / floors;
    for (const side of [false, true]) {
      for (const offset of side ? [-0.19, 0.1] : [-0.23, 0.23]) {
        const coord = (x, h) =>
          side ? [x, asset.halfC + 0.008, h] : [asset.halfR + 0.008, x, h];
        const panel = (left, right, low, high, fill) =>
          p.face(
            [
              coord(left, low),
              coord(right, low),
              coord(right, high),
              coord(left, high),
            ],
            fill,
            FINE,
          );
        panel(
          offset - 0.078,
          offset + 0.078,
          bottom - 1.2,
          bottom + 11.2,
          side ? "#c8c6ae" : "#f3e5c5",
        );
        panel(offset - 0.06, offset + 0.06, bottom, bottom + 10, "#3e6675");
        panel(
          offset - 0.05,
          offset + 0.05,
          bottom + 0.6,
          bottom + 9.1,
          side ? "#6698a7" : GLASS,
        );
        p.face(
          [
            coord(offset - 0.046, bottom + 8.6),
            coord(offset + 0.04, bottom + 8.6),
            coord(offset - 0.046, bottom + 4.3),
          ],
          "#c0ded6",
          { stroke: "none", opacity: 0.75 },
        );
        mullions.push([
          coord(offset, bottom + 0.4),
          coord(offset, bottom + 9.5),
        ]);
        mullions.push([
          coord(offset - 0.057, bottom + 4.3),
          coord(offset + 0.057, bottom + 4.3),
        ]);
        mullions.push([
          coord(offset - 0.084, bottom - 1.3),
          coord(offset + 0.084, bottom - 1.3),
        ]);
      }
    }
  }
  p.strokes(mullions, { stroke: "#e8dfc5", "stroke-width": 0.65 });
}
function doorway(p, a, wallHeight, double = false) {
  const r = a.halfR + 0.012;
  const top = Math.min(25, wallHeight - 3);
  frontPanel(p, r, -0.115, 0.115, 3, top + 2, "#efe1bb", FINE);
  frontPanel(p, r + 0.002, -0.095, 0.095, 3, top, "#365563", FINE);
  for (const c of [-0.045, 0.045]) {
    frontPanel(p, r + 0.004, c - 0.032, c + 0.032, 8, top - 2, "#87b2b5", FINE);
    frontPanel(p, r + 0.006, c - 0.031, c + 0.031, 4.5, 7, "#667f79", FINE);
  }
  p.strokes(
    [
      [
        [r + 0.008, -0.08, top - 3],
        [r + 0.008, -0.025, top - 7],
      ],
      [
        [r + 0.008, -0.01, 10],
        [r + 0.008, -0.01, 13],
      ],
      [
        [r + 0.008, 0.015, 10],
        [r + 0.008, 0.015, 13],
      ],
      ...(double
        ? [
            [
              [r + 0.008, 0, 3],
              [r + 0.008, 0, top],
            ],
          ]
        : []),
    ],
    { stroke: "#ead7a7", "stroke-width": 0.6 },
  );
  p.box(a.halfR, -0.12, a.halfR + 0.055, 0.12, 2, 3.5, STONE, FINE);
}
function wallDetails(p, a, wall, floors = 1) {
  frontPanel(p, a.halfR + 0.003, -a.halfC, a.halfC, 3, 6, "#c6b89a", FINE);
  sidePanel(p, a.halfC + 0.003, -a.halfR, a.halfR, 3, 6, "#a39e88", FINE);
  p.strokes(
    [
      [
        [a.halfR + 0.006, -a.halfC, wall - 2],
        [a.halfR + 0.006, a.halfC, wall - 2],
      ],
      [
        [-a.halfR, a.halfC + 0.006, wall - 2],
        [a.halfR, a.halfC + 0.006, wall - 2],
      ],
      ...Array.from({ length: floors - 1 }, (_, i) => {
        const h = 8 + ((i + 1) * (wall - 16)) / floors;
        return [
          [a.halfR + 0.006, -a.halfC, h],
          [a.halfR + 0.006, a.halfC, h],
          [-a.halfR, a.halfC + 0.006, h],
        ];
      }),
    ],
    { stroke: "#eee1be", "stroke-width": 0.9 },
  );
  for (const c of [-a.halfC + 0.025, a.halfC - 0.025])
    frontPanel(
      p,
      a.halfR + 0.005,
      c - 0.014,
      c + 0.014,
      6,
      wall - 3,
      "#eddcba",
      { stroke: "none" },
    );
}

function mountainHeight(map, r, c) {
  return map.terrain[r]?.[c] === "MOUNTAIN" ? 52 + ((r * 13 + c * 7) % 13) : 0;
}
function mountainCorner(map, r, c) {
  const heights = [
    [Math.floor(r), Math.floor(c)],
    [Math.ceil(r), Math.floor(c)],
    [Math.floor(r), Math.ceil(c)],
    [Math.ceil(r), Math.ceil(c)],
  ]
    .map(([rr, cc]) => mountainHeight(map, rr, cc))
    .filter(Boolean);
  return heights.length > 1
    ? (heights.reduce((a, b) => a + b, 0) / heights.length) * 0.2
    : 0;
}
export function getMountainProfile(map, r, c) {
  const height = mountainHeight(map, r, c);
  const peak = [-0.07, 0.025, height];
  const corners = [
    [-0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
    [0.5, -0.5],
  ];
  const ring = [];
  corners.forEach(([localR, localC], index) => {
    ring.push([localR, localC, mountainCorner(map, r + localR, c + localC)]);
    const [nr, nc] = corners[(index + 1) % 4];
    const mr = (localR + nr) / 2,
      mc = (localC + nc) / 2;
    const adjacent = mountainHeight(map, r + mr * 2, c + mc * 2);
    ring.push([mr, mc, adjacent ? (height + adjacent) * 0.26 : 0]);
  });
  return { peak, ring };
}
function mountain(p, cell, map) {
  const { peak, ring } = getMountainProfile(map, cell.r, cell.c);
  const colors = [
    "#c2cbb0",
    "#b7c5a6",
    "#96aa92",
    "#859b87",
    "#94a78d",
    "#a4b598",
    "#b5c1a2",
    "#c8cfb4",
  ];
  ring.forEach((point, index) => {
    const next = ring[(index + 1) % ring.length];
    p.face([peak, point, next], colors[index], {
      stroke: "#849882",
      "stroke-width": 0.35,
    });
    const snow = [peak, point, next].map(([r, c, h], i) =>
      i === 0
        ? [r, c, h]
        : [
            peak[0] + (r - peak[0]) * 0.22,
            peak[1] + (c - peak[1]) * 0.22,
            peak[2] + (h - peak[2]) * 0.22,
          ],
    );
    p.face(snow, index < 3 ? "#f6efdc" : "#dce2d0", { stroke: "none" });
    const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    const centre = lerp(point, next, 0.45);
    p.face(
      [
        lerp(peak, point, 0.45),
        lerp(peak, centre, 0.84),
        lerp(peak, next, 0.67),
      ],
      index < 3 ? "#a5b59d" : "#7f9684",
      { stroke: "none", opacity: 0.4 },
    );
    p.strokes(
      [
        [
          lerp(peak, centre, 0.48),
          lerp(peak, centre, 0.66),
          lerp(peak, point, 0.78),
        ],
      ],
      { stroke: "#6d887c", "stroke-width": 0.45, "stroke-opacity": 0.55 },
    );
  });
}

export function renderSceneryShadow(parent, cell, projection) {
  const asset = SCENERY_ASSETS[cell.tileType];
  if (!asset) return;
  const p = createPainter(parent, cell, projection);
  const vertices = [
    [-asset.halfR, -asset.halfC],
    [asset.halfR, -asset.halfC],
    [asset.halfR, asset.halfC],
    [-asset.halfR, asset.halfC],
  ].map(([r, c]) => p.at(r, c));
  const shift = { x: asset.height * 0.2, y: asset.height * 0.11 };
  polygon(
    parent,
    [
      vertices[1],
      vertices[2],
      vertices[3],
      ...vertices
        .slice()
        .reverse()
        .map(({ x, y }) => ({ x: x + shift.x, y: y + shift.y })),
    ],
    {
      fill: "#4f6258",
      opacity: 0.14,
      stroke: "none",
      class: "iso-cast-shadow",
    },
  );
}

export function renderScenery(parent, cell, projection, map) {
  const a = SCENERY_ASSETS[cell.tileType];
  if (!a) return;
  parent.setAttribute("data-asset", cell.tileType);
  parent.setAttribute("data-front", a.front || "terrain");
  const p = createPainter(parent, cell, projection);
  if (cell.tileType === "MOUNTAIN") {
    mountain(p, cell, map);
    return;
  }
  const colors = { front: a.color, side: a.side, top: a.roof };
  if (cell.tileType === "BARRIER") {
    for (const c of [-0.28, 0.28])
      p.box(-0.16, c - 0.035, 0.16, c + 0.035, 0, 4, STONE);
    p.box(-0.035, -0.35, 0.035, -0.3, 2, 20, STONE);
    p.box(-0.035, 0.3, 0.035, 0.35, 2, 20, STONE);
    p.box(-0.07, -0.4, 0.07, 0.4, 10, 22, colors);
    for (let c = -0.37; c < 0.36; c += 0.19) {
      p.face(
        [
          [0.074, c, 11],
          [0.074, c + 0.07, 11],
          [0.074, c + 0.12, 21],
          [0.074, c + 0.05, 21],
        ],
        "#c67860",
        { stroke: "none" },
      );
    }
    p.strokes(
      [
        [
          [0.077, -0.38, 20.5],
          [0.077, 0.38, 20.5],
        ],
        [
          [0.078, -0.31, 14.5],
          [0.078, -0.31, 18],
        ],
        [
          [0.078, 0.31, 14.5],
          [0.078, 0.31, 18],
        ],
      ],
      { stroke: "#fff0bf", "stroke-width": 0.9 },
    );
    return;
  }
  p.box(
    -a.halfR - 0.035,
    -a.halfC - 0.035,
    a.halfR + 0.035,
    a.halfC + 0.035,
    0,
    3,
    STONE,
  );
  if (cell.tileType === "CONSTRUCTION_SITE") {
    for (const h of [3, 25, 47]) {
      p.box(-a.halfR, -a.halfC, a.halfR, a.halfC, h, h + 3, STONE);
      if (h < 47)
        for (const r of [-0.29, 0.29])
          for (const c of [-0.3, 0.3])
            p.box(r - 0.025, c - 0.025, r + 0.025, c + 0.025, h + 3, h + 22, {
              front: "#c7b68d",
              side: "#9d967e",
              top: "#e5d4a7",
            });
    }
    frontPanel(p, a.halfR + 0.005, -0.29, 0.02, 3, 17, "#c88e68");
    const mortar = [];
    for (let row = 0; row < 3; row += 1) {
      const h = 3 + row * 4.6;
      mortar.push([
        [a.halfR + 0.01, -0.29, h],
        [a.halfR + 0.01, 0.02, h],
      ]);
      for (let i = 1; i < 4; i += 1) {
        const c = -0.29 + (i - (row % 2) * 0.5) * 0.09;
        mortar.push([
          [a.halfR + 0.01, c, h],
          [a.halfR + 0.01, c, h + 4.6],
        ]);
      }
    }
    p.strokes(mortar, { stroke: "#efd1ac", "stroke-width": 0.55 });
    p.strokes(
      [
        [
          [-0.28, a.halfC + 0.004, 7],
          [0.28, a.halfC + 0.004, 24],
        ],
        [
          [0.28, a.halfC + 0.004, 7],
          [-0.28, a.halfC + 0.004, 24],
        ],
        [
          [a.halfR + 0.005, 0.08, 29],
          [a.halfR + 0.005, 0.08, 44],
        ],
        [
          [a.halfR + 0.005, 0.23, 29],
          [a.halfR + 0.005, 0.23, 44],
        ],
        ...[30, 34, 38, 42].map((h) => [
          [a.halfR + 0.005, 0.08, h],
          [a.halfR + 0.005, 0.23, h],
        ]),
      ],
      { stroke: "#9b8c70", "stroke-width": 0.9 },
    );
    return;
  }
  const wall = a.height - (cell.tileType === "BUILDING" ? 6 : 21);
  p.box(-a.halfR, -a.halfC, a.halfR, a.halfC, 3, wall, colors);
  wallDetails(
    p,
    a,
    wall,
    cell.tileType === "BUILDING"
      ? 3
      : cell.tileType === "POLICE_STATION"
        ? 2
        : 1,
  );
  if (cell.tileType === "BUILDING") {
    p.box(
      -a.halfR - 0.025,
      -a.halfC - 0.025,
      a.halfR + 0.025,
      a.halfC + 0.025,
      wall,
      wall + 5,
      { front: "#b6bda6", side: "#819797", top: a.roof },
    );
    windows(p, a, wall, 3);
    doorway(p, a, wall);
    p.box(-0.2, -0.18, -0.06, 0.04, wall + 5, wall + 9, STONE, FINE);
    p.strokes(
      [-0.14, -0.09, -0.04].map((c) => [
        [-0.19, c, wall + 9.1],
        [-0.07, c, wall + 9.1],
      ]),
      { stroke: "#8a978c", "stroke-width": 0.65 },
    );
    p.strokes(
      [
        [
          [a.halfR - 0.02, -a.halfC + 0.02, wall + 5.1],
          [a.halfR - 0.02, a.halfC - 0.02, wall + 5.1],
          [-a.halfR + 0.02, a.halfC - 0.02, wall + 5.1],
        ],
      ],
      { stroke: "#d5dbbd", "stroke-width": 1 },
    );
    return;
  }
  roof(p, a.halfR + 0.025, a.halfC + 0.025, wall, a.height, a.roof);
  windows(p, a, wall, cell.tileType === "POLICE_STATION" ? 2 : 1);
  doorway(p, a, wall, cell.tileType === "BANK" || cell.tileType === "FARM");
  if (cell.tileType === "BANK") {
    p.box(a.halfR, -0.4, a.halfR + 0.13, 0.4, 0, 3, STONE);
    p.box(a.halfR, -0.37, a.halfR + 0.095, 0.37, 3, 6, STONE);
    for (const c of [-0.3, -0.13, 0.13, 0.3]) {
      p.box(
        a.halfR + 0.005,
        c - 0.039,
        a.halfR + 0.075,
        c + 0.039,
        6,
        8,
        STONE,
        FINE,
      );
      p.box(
        a.halfR + 0.02,
        c - 0.027,
        a.halfR + 0.06,
        c + 0.027,
        6,
        wall - 2,
        STONE,
      );
      p.box(
        a.halfR + 0.005,
        c - 0.041,
        a.halfR + 0.075,
        c + 0.041,
        wall - 3,
        wall,
        STONE,
      );
    }
    p.strokes(
      [-0.3, -0.13, 0.13, 0.3].flatMap((c) =>
        [-0.012, 0.012].map((d) => [
          [a.halfR + 0.063, c + d, 9],
          [a.halfR + 0.063, c + d, wall - 4],
        ]),
      ),
      { stroke: "#b6aa8c", "stroke-width": 0.5 },
    );
    p.box(a.halfR - 0.015, -0.41, a.halfR + 0.105, 0.41, wall, wall + 4, STONE);
    p.face(
      [
        [a.halfR + 0.11, -0.4, wall + 4],
        [a.halfR + 0.11, 0.4, wall + 4],
        [a.halfR + 0.11, 0, a.height - 2],
      ],
      "#efdfad",
    );
    const emblemR = a.halfR + 0.115;
    p.face(
      Array.from({ length: 16 }, (_, i) => {
        const angle = (i * Math.PI) / 8;
        return [
          emblemR,
          Math.cos(angle) * 0.058,
          wall + 10 + Math.sin(angle) * 4.5,
        ];
      }),
      "#d2b368",
      FINE,
    );
    p.strokes(
      [
        [
          [emblemR + 0.002, 0, wall + 6.8],
          [emblemR + 0.002, 0, wall + 13.2],
        ],
        [
          [emblemR + 0.002, 0.025, wall + 12],
          [emblemR + 0.002, -0.027, wall + 12],
          [emblemR + 0.002, -0.027, wall + 10],
          [emblemR + 0.002, 0.027, wall + 10],
          [emblemR + 0.002, 0.027, wall + 8],
          [emblemR + 0.002, -0.025, wall + 8],
        ],
        [
          [emblemR, -0.32, wall + 5],
          [emblemR, 0, a.height - 5],
          [emblemR, 0.32, wall + 5],
        ],
      ],
      { stroke: "#f6eac3", "stroke-width": 0.65 },
    );
  } else if (cell.tileType === "POLICE_STATION") {
    for (const [c, color] of [
      [-0.12, "#c96d5c"],
      [0.12, "#6f9fb8"],
    ])
      p.box(-0.07, c - 0.045, 0.04, c + 0.045, a.height - 5, a.height + 1, {
        front: color,
        side: color,
        top: "#f3dfb1",
      });
    const r = a.halfR + 0.012;
    p.face(
      [
        [r, -0.07, wall + 12],
        [r, 0.07, wall + 12],
        [r, 0.055, wall + 6],
        [r, 0, wall + 3],
        [r, -0.055, wall + 6],
      ],
      "#d7b966",
      FINE,
    );
    p.strokes(
      [
        [
          [r + 0.002, -0.035, wall + 10],
          [r + 0.002, 0.035, wall + 10],
          [r + 0.002, 0.028, wall + 7],
          [r + 0.002, 0, wall + 5.5],
          [r + 0.002, -0.028, wall + 7],
          [r + 0.002, -0.035, wall + 10],
        ],
      ],
      { stroke: "#f5e5b7", "stroke-width": 0.55 },
    );
    frontPanel(p, r, -0.12, 0.12, 27, 30, "#628d9e", FINE);
  } else if (cell.tileType === "THIEF_BASE") {
    p.box(-0.2, 0.12, -0.1, 0.23, wall + 8, a.height + 4, {
      front: "#d1aa83",
      side: "#9b8b75",
      top: "#e9ca98",
    });
    p.strokes(
      [a.height - 4, a.height].map((h) => [
        [-0.1, 0.12, h],
        [-0.1, 0.23, h],
        [-0.2, 0.23, h],
      ]),
      { stroke: "#e7cda8", "stroke-width": 0.65 },
    );
    p.face(
      [
        [-0.19, 0.135, a.height + 4.1],
        [-0.19, 0.215, a.height + 4.1],
        [-0.11, 0.215, a.height + 4.1],
        [-0.11, 0.135, a.height + 4.1],
      ],
      "#6d7467",
      FINE,
    );
  } else if (cell.tileType === "FARM") {
    frontPanel(p, a.halfR + 0.015, -0.14, 0.14, 3, 27, "#775d4b");
    p.strokes(
      [-0.105, -0.07, -0.035, 0, 0.035, 0.07, 0.105].map((c) => [
        [a.halfR + 0.018, c, 4],
        [a.halfR + 0.018, c, 26],
      ]),
      { stroke: "#a18765", "stroke-width": 0.45 },
    );
    p.edge([a.halfR + 0.02, -0.13, 4], [a.halfR + 0.02, 0.13, 26], {
      stroke: "#f0d1a2",
      "stroke-width": 1.5,
    });
    p.edge([a.halfR + 0.02, 0.13, 4], [a.halfR + 0.02, -0.13, 26], {
      stroke: "#f0d1a2",
      "stroke-width": 1.5,
    });
  }
}
