import { projectSurfacePoint } from "./projection.js";

export function svgElement(tag, attributes = {}, text = null) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attributes))
    element.setAttribute(name, value);
  if (text !== null) element.textContent = text;
  return element;
}

export function polygon(parent, vertices, attributes = {}) {
  const element = svgElement("polygon", {
    points: vertices.map(({ x, y }) => `${x},${y}`).join(" "),
    ...attributes,
  });
  parent.appendChild(element);
  return element;
}

export function line(parent, a, b, attributes = {}) {
  const element = svgElement("line", {
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
    ...attributes,
  });
  parent.appendChild(element);
  return element;
}

// All buildings and vehicles use the same world axes and fixed lighting.
// h is the object's height above its road/bridge/ramp surface, in display units.
export function createPainter(parent, cell, projection, transform = {}) {
  const at = (r, c, h = 0) => {
    const point = projectSurfacePoint(
      cell,
      r * (transform.scaleR ?? 1) + (transform.offsetR ?? 0),
      c * (transform.scaleC ?? 1) + (transform.offsetC ?? 0),
      projection,
    );
    return { x: point.x, y: point.y - h * (transform.scaleHeight ?? 1) };
  };
  const face = (vertices, fill, attributes = {}) =>
    polygon(
      parent,
      vertices.map(([r, c, h]) => at(r, c, h)),
      {
        fill,
        stroke: "#53656b",
        "stroke-width": 0.7,
        "stroke-linejoin": "round",
        ...attributes,
      },
    );
  const edge = (a, b, attributes = {}) =>
    line(parent, at(...a), at(...b), {
      stroke: "#53656b",
      "stroke-width": 0.8,
      ...attributes,
    });
  // Batch fine seams into one path so detailed art stays inexpensive to render.
  const strokes = (segments, attributes = {}) => {
    const d = segments
      .map((vertices) =>
        vertices
          .map((vertex, i) => {
            const { x, y } = at(...vertex);
            return `${i ? "L" : "M"}${x},${y}`;
          })
          .join(" "),
      )
      .join(" ");
    const element = svgElement("path", {
      d,
      fill: "none",
      stroke: "#53656b",
      "stroke-width": 0.55,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      ...attributes,
    });
    parent.appendChild(element);
    return element;
  };
  function box(r0, c0, r1, c1, bottom, top, colors, attributes = {}) {
    face(
      [
        [r1, c0, bottom],
        [r1, c1, bottom],
        [r1, c1, top],
        [r1, c0, top],
      ],
      colors.front,
      attributes,
    );
    face(
      [
        [r0, c1, bottom],
        [r1, c1, bottom],
        [r1, c1, top],
        [r0, c1, top],
      ],
      colors.side,
      attributes,
    );
    face(
      [
        [r0, c0, top],
        [r0, c1, top],
        [r1, c1, top],
        [r1, c0, top],
      ],
      colors.top,
      attributes,
    );
  }
  return { at, face, edge, strokes, box };
}
