import { createPainter, svgElement } from "./artPrimitives.js";

// Leave room beside the car, slightly in front of its centre for depth sorting.
export const PARKING_SIGN_BASE = { r: 0.38, c: -0.29 };

export function renderParkingSign(parent, cell, projection) {
  const p = createPainter(parent, cell, projection);
  const { r, c } = PARKING_SIGN_BASE;
  const baseHeight = 1.7;
  p.box(
    r - 0.045, c - 0.045, r + 0.045, c + 0.045, 0, baseHeight,
    { front: "#b7bfa9", side: "#919f92", top: "#e2dfc4" },
    { "stroke-width": 0.45, class: "iso-parking-footing" },
  );
  p.edge([r, c, baseHeight], [r, c, 23], {
    stroke: "#607c78",
    "stroke-width": 1.8,
    class: "iso-parking-pole",
  });

  const frontR = r + 0.025;
  p.box(
    r - 0.025, c - 0.19, frontR, c + 0.19, 15, 31,
    { front: "var(--parking-sign-color)", side: "#1d4c45", top: "#6b9584" },
    { stroke: "#fffdf1", "stroke-width": 0.85, class: "iso-parking-plaque" },
  );
  // The letter follows the column axis across the face and stays vertical in height.
  const label = p.at(frontR, c, 23);
  parent.appendChild(svgElement("text", {
    "aria-hidden": "true",
    class: "iso-parking-letter",
    transform: `matrix(1 ${projection.tileHeight / projection.tileWidth} 0 1 ${label.x} ${label.y})`,
    y: 4.5,
    "text-anchor": "middle",
  }, "P"));
}
