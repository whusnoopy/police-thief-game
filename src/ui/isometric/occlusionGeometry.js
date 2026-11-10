import { pointInPolygon } from "./projection.js";

const attr = (el, name) => el.getAttribute?.(name) ?? el.attributes?.[name];
export function inBounds(point, b) {
  return (
    point.x >= b.x &&
    point.x <= b.x + b.width &&
    point.y >= b.y &&
    point.y <= b.y + b.height
  );
}
export function intersectBounds(a, b) {
  const x = Math.max(a.x, b.x),
    y = Math.max(a.y, b.y);
  const width = Math.min(a.x + a.width, b.x + b.width) - x;
  const height = Math.min(a.y + a.height, b.y + b.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}
function distanceToSegment(point, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}
function shape(vertices, fill, strokeWidth, close = false) {
  const xs = vertices.map((v) => v.x),
    ys = vertices.map((v) => v.y),
    pad = strokeWidth / 2;
  const bounds = {
    x: Math.min(...xs) - pad,
    y: Math.min(...ys) - pad,
    width: Math.max(...xs) - Math.min(...xs) + pad * 2,
    height: Math.max(...ys) - Math.min(...ys) + pad * 2,
  };
  return {
    bounds,
    contains(point) {
      if (!inBounds(point, bounds)) return false;
      if (fill && pointInPolygon(point, vertices)) return true;
      return (
        strokeWidth > 0 &&
        vertices.some((a, i) => {
          const b = vertices[i + 1] || (close ? vertices[0] : null);
          return b && distanceToSegment(point, a, b) <= pad;
        })
      );
    },
  };
}

// All art primitives are already projected in world coordinates. Shadows,
// labels, image rectangles and transparent gaps never become opaque geometry.
export function readOpaqueGeometry(root) {
  const shapes = [];
  function walk(el) {
    if (
      el.classList?.contains("iso-vehicle-shadow") ||
      attr(el, "display") === "none"
    )
      return;
    const tag = el.tagName?.toLowerCase();
    const stroke = attr(el, "stroke"),
      sw =
        stroke && stroke !== "none" ? Number(attr(el, "stroke-width") || 1) : 0;
    if (tag === "polygon") {
      const vertices = String(attr(el, "points"))
        .trim()
        .split(/\s+/)
        .map((pair) => {
          const [x, y] = pair.split(",").map(Number);
          return { x, y };
        });
      shapes.push(shape(vertices, attr(el, "fill") !== "none", sw, true));
    } else if (tag === "line") {
      shapes.push(
        shape(
          [
            { x: +attr(el, "x1"), y: +attr(el, "y1") },
            { x: +attr(el, "x2"), y: +attr(el, "y2") },
          ],
          false,
          sw,
        ),
      );
    } else if (tag === "path" && sw) {
      let vertices = [];
      for (const match of String(attr(el, "d")).matchAll(
        /([ML])\s*([-+\d.e]+)[,\s]+([-+\d.e]+)/g,
      )) {
        if (match[1] === "M" && vertices.length) {
          shapes.push(shape(vertices, false, sw));
          vertices = [];
        }
        vertices.push({ x: +match[2], y: +match[3] });
      }
      if (vertices.length) shapes.push(shape(vertices, false, sw));
    }
    for (const child of el.children || []) walk(child);
  }
  walk(root);
  const bounds = shapes.length
    ? {
        x: Math.min(...shapes.map((s) => s.bounds.x)),
        y: Math.min(...shapes.map((s) => s.bounds.y)),
        width: 0,
        height: 0,
      }
    : { x: 0, y: 0, width: 0, height: 0 };
  if (shapes.length) {
    bounds.width =
      Math.max(...shapes.map((s) => s.bounds.x + s.bounds.width)) - bounds.x;
    bounds.height =
      Math.max(...shapes.map((s) => s.bounds.y + s.bounds.height)) - bounds.y;
  }
  return {
    bounds,
    contains: (point) =>
      inBounds(point, bounds) && shapes.some((s) => s.contains(point)),
  };
}

export function getOccludingRecords(actor, records) {
  return records.filter(
    (record) =>
      record.index > actor.index &&
      intersectBounds(actor.bounds, record.bounds),
  );
}

export function hasActualOcclusion(actor, occluders) {
  const point = { x: 0, y: 0 };
  for (const front of occluders) {
    const box = intersectBounds(actor.bounds, front.bounds);
    if (!box) continue;
    if (box.width >= 4 && box.height >= 4) {
      for (let y = box.y + 2; y <= box.y + box.height; y += 4) {
        point.y = y;
        for (let x = box.x + 2; x <= box.x + box.width; x += 4) {
          point.x = x;
          if (actor.contains(point) && front.contains(point)) return true;
        }
      }
    }
    for (let y = box.y + 0.5; y <= box.y + box.height; y += 1) {
      point.y = y;
      for (let x = box.x + 0.5; x <= box.x + box.width; x += 1) {
        point.x = x;
        if (actor.contains(point) && front.contains(point)) return true;
      }
    }
  }
  return false;
}

export function pickOccludedActor(point, actors, preferred = new Set()) {
  let fallback = null;
  for (let i = actors.length - 1; i >= 0; i -= 1) {
    const actor = actors[i];
    if (
      !actor.occluded ||
      !inBounds(point, actor.bounds) ||
      !actor.contains(point) ||
      !actor.occluders.some((front) => front.contains(point))
    )
      continue;
    if (preferred.has(`${actor.cell.r},${actor.cell.c}`)) return actor.cell;
    fallback ||= actor.cell;
  }
  return fallback;
}
