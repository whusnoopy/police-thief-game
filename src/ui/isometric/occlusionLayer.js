import { svgElement, line } from "./artPrimitives.js";
import { appendVehicleArtwork } from "./vehicleArt.js";
import { getSpriteAlpha } from "./spriteAlpha.js";
import {
  getOccludingRecords,
  hasActualOcclusion,
  intersectBounds,
  readOpaqueGeometry,
} from "./occlusionGeometry.js";

const COLORS = {
  police: "#278ac2",
  thief: "#c56a49",
  animal: "#8b6ca6",
  car: "#9a7a36",
};

export function createActorRecord(
  defs,
  cell,
  layout,
  projection,
  id,
  index,
  changed,
) {
  const body = svgElement("g", { id: `${id}-body` });
  defs.appendChild(body);
  const record = {
    id,
    maskId: `${id}-body`,
    index,
    cell,
    layout,
    bounds: layout.bounds,
    failed: false,
    color: COLORS[cell.side || "car"],
    body,
    occluded: false,
    occluders: [],
  };
  if (layout.vehicle) {
    const source = appendVehicleArtwork(
      body,
      cell,
      projection,
      cell.direction,
      cell.side === "police",
    );
    source.setAttribute("class", "iso-mask-car");
    for (const shadow of source.querySelectorAll(".iso-vehicle-shadow"))
      shadow.remove();
    source.setAttribute("x", cell.anchor.x - 38);
    source.setAttribute("y", cell.anchor.y - 50);
    source.setAttribute("width", 76);
    source.setAttribute("height", 76);
    source.style.width = "76px";
    source.style.height = "76px";
    const geometry = readOpaqueGeometry(source);
    const s = layout.scale;
    body.setAttribute(
      "transform",
      `matrix(${s} 0 0 ${s} ${layout.foot.x - s * cell.anchor.x} ${layout.foot.y - s * cell.anchor.y})`,
    );
    record.contains = (point) =>
      geometry.contains({
        x: (point.x - layout.foot.x) / s + cell.anchor.x,
        y: (point.y - layout.foot.y) / s + cell.anchor.y,
      });
    record.unsubscribe = () => {};
  } else {
    record.url = new URL(
      `../../assets/isometric/${layout.name}.webp`,
      import.meta.url,
    ).href;
    const solid = svgElement("filter", {
      id: `${id}-solid`,
      "color-interpolation-filters": "sRGB",
    });
    const transfer = svgElement("feComponentTransfer");
    transfer.appendChild(
      svgElement("feFuncA", { type: "discrete", tableValues: "0 0 1 1" }),
    );
    solid.appendChild(transfer);
    defs.appendChild(solid);
    body.setAttribute("filter", `url(#${id}-solid)`);
    body.appendChild(
      svgElement("image", {
        href: record.url,
        x: layout.left,
        y: layout.top,
        width: layout.width,
        height: layout.height,
      }),
    );
    record.alpha = getSpriteAlpha(record.url);
    record.contains = (point) =>
      !record.failed &&
      record.alpha.contains(
        (point.x - layout.left) / layout.width,
        (point.y - layout.top) / layout.height,
      );
    record.unsubscribe = record.alpha.subscribe(changed);
  }
  return record;
}

function appendFilter(defs, actor) {
  const b = actor.bounds;
  const filter = svgElement("filter", {
    id: `${actor.id}-stroke`,
    filterUnits: "userSpaceOnUse",
    x: b.x - 6,
    y: b.y - 6,
    width: b.width + 12,
    height: b.height + 12,
    "color-interpolation-filters": "sRGB",
  });
  const outer = svgElement("feMorphology", {
    in: "SourceAlpha",
    operator: "dilate",
    radius: 2.2,
    result: "outer",
  });
  const inner = svgElement("feMorphology", {
    in: "SourceAlpha",
    operator: "dilate",
    radius: 1.1,
    result: "inner",
  });
  const color = svgElement("feFlood", {
    "flood-color": actor.color,
    result: "color",
  });
  filter.append(
    outer,
    inner,
    svgElement("feMorphology", {
      in: "SourceAlpha",
      operator: "erode",
      radius: 0.3,
      result: "core",
    }),
    svgElement("feComposite", {
      in: "outer",
      in2: "core",
      operator: "out",
      result: "haloRing",
    }),
    svgElement("feFlood", { "flood-color": "#fff9df", result: "white" }),
    svgElement("feComposite", {
      in: "white",
      in2: "haloRing",
      operator: "in",
      result: "halo",
    }),
    svgElement("feComposite", {
      in: "inner",
      in2: "core",
      operator: "out",
      result: "colorRing",
    }),
    color,
    svgElement("feComposite", {
      in: "color",
      in2: "colorRing",
      operator: "in",
      result: "stroke",
    }),
  );
  const merge = svgElement("feMerge");
  merge.append(
    svgElement("feMergeNode", { in: "halo" }),
    svgElement("feMergeNode", { in: "stroke" }),
  );
  filter.appendChild(merge);
  defs.appendChild(filter);
  return { filter, outer, inner, color };
}

export function rebuildOcclusion(defs, layer, actors, records, selected) {
  layer.innerHTML = "";
  for (const actor of actors) {
    actor.mask?.remove();
    actor.stroke?.filter.remove();
    actor.occluders = getOccludingRecords(actor, records);
    actor.failed ||= actor.alpha?.status === "failed";
    actor.occluded = hasActualOcclusion(actor, actor.occluders);
    actor.outline = null;
    if (!actor.occluded) continue;
    const b = actor.bounds;
    const mask = svgElement("mask", {
      id: `${actor.id}-hidden`,
      maskUnits: "userSpaceOnUse",
      maskContentUnits: "userSpaceOnUse",
      x: b.x - 5,
      y: b.y - 5,
      width: b.width + 10,
      height: b.height + 10,
      "mask-type": "alpha",
      style: "mask-type: alpha",
    });
    for (const front of actor.occluders)
      mask.appendChild(svgElement("use", { href: `#${front.maskId}` }));
    defs.appendChild(mask);
    actor.mask = mask;
    actor.stroke = appendFilter(defs, actor);
    actor.outline = svgElement("g", {
      class: "iso-occluded-outline",
      mask: `url(#${actor.id}-hidden)`,
      "data-id": actor.cell.unit?.id || "car",
      "data-r": actor.cell.r,
      "data-c": actor.cell.c,
      "aria-hidden": "true",
      "pointer-events": "none",
    });
    actor.outline.appendChild(
      svgElement("use", {
        href: `#${actor.maskId}`,
        filter: `url(#${actor.id}-stroke)`,
      }),
    );
    layer.appendChild(actor.outline);
  }
  updateOutlineSelection(actors, selected);
}

export function updateOutlineSelection(actors, selected) {
  for (const actor of actors) {
    if (!actor.outline) continue;
    const active = selected?.r === actor.cell.r && selected?.c === actor.cell.c;
    actor.outline.classList.toggle("selected", active);
    actor.stroke.outer.setAttribute("radius", active ? 3.2 : 2.2);
    actor.stroke.inner.setAttribute("radius", active ? 1.8 : 1.1);
    actor.stroke.color.setAttribute(
      "flood-color",
      active ? "#e8a01d" : actor.color,
    );
  }
}

function stateIcon(parent, kind, x, y) {
  const group = svgElement("g", {
    class: `iso-state-icon ${kind}`,
    transform: `translate(${x} ${y})`,
  });
  group.appendChild(
    svgElement("rect", {
      x: 0,
      y: 0,
      width: 18,
      height: 18,
      rx: 3,
      fill: "#fff9e8",
      stroke: "#c3b38e",
      "stroke-width": 0.6,
    }),
  );
  const icon = svgElement("g", { transform: "translate(1 1) scale(.67)" });
  if (kind === "money") {
    icon.append(
      svgElement("path", {
        d: "M9 9 7 3h10l-2 6c6 4 8 12-3 12S3 13 9 9Z",
        fill: "#e7c36f",
        stroke: "#84693d",
        "stroke-width": 1.6,
      }),
      svgElement("path", { d: "M8 9h8", stroke: "#84693d", "stroke-width": 2 }),
      svgElement("circle", {
        cx: 12,
        cy: 15,
        r: 2,
        fill: "none",
        stroke: "#84693d",
      }),
    );
  } else {
    icon.append(
      svgElement("circle", {
        cx: 6,
        cy: 14,
        r: 4,
        fill: "none",
        stroke: "#54768d",
        "stroke-width": 2.5,
      }),
      svgElement("circle", {
        cx: 18,
        cy: 9,
        r: 4,
        fill: "none",
        stroke: "#54768d",
        "stroke-width": 2.5,
      }),
      svgElement("path", {
        d: "M9 11l6-1",
        stroke: "#54768d",
        "stroke-width": 2.5,
      }),
    );
  }
  group.appendChild(icon);
  parent.appendChild(group);
}

export function renderActorLabels(
  layer,
  actors,
  projection,
  selected,
  keys,
  bind,
) {
  layer.innerHTML = "";
  const placed = [];
  const isSelected = (actor) =>
    selected?.r === actor.cell.r && selected?.c === actor.cell.c;
  const ordered = actors
    .filter(
      (actor) =>
        actor.cell.side === "police" ||
        actor.cell.side === "thief" ||
        actor.occluded ||
        actor.failed,
    )
    .sort(
      (a, b) =>
        Number(isSelected(b)) - Number(isSelected(a)) || b.index - a.index,
    );
  for (const actor of ordered) {
    const { cell, layout } = actor;
    const id = cell.unit?.id || `car-${cell.r}-${cell.c}`;
    const text =
      cell.side === "animal"
        ? layout.name === "cow"
          ? "牛"
          : "猪"
        : cell.kind === "car"
          ? "空车"
          : actor.failed
            ? `${cell.side === "police" ? "警察" : "小偷"}${cell.unit.id}`
            : cell.unit.id;
    const title =
      cell.kind === "car"
        ? "空车"
        : `${cell.side === "police" ? "警察" : cell.side === "thief" ? "小偷" : text} ${cell.unit.id}${cell.unit.hasMoney ? "，携款" : ""}${cell.unit.state === "CARRYING" ? "，押送小偷" : ""}`;
    const icons = [
      cell.unit?.hasMoney ? "money" : null,
      cell.unit?.state === "CARRYING" ? "escort" : null,
    ].filter(Boolean);
    const tagWidth = Math.max(25, text.length * 9 + 8);
    const width = tagWidth + icons.length * 21,
      height = 18;
    const initial = {
      x: layout.foot.x - width / 2,
      y: layout.top - 17,
      width,
      height,
    };
    const candidates = [
      [0, 0],
      [0, -21],
      [0, 21],
      [-width - 4, 0],
      [width + 4, 0],
      [0, -42],
      [0, 42],
      [-width - 4, -21],
      [width + 4, -21],
    ];
    let box;
    for (const [dx, dy] of candidates) {
      const candidate = {
        ...initial,
        x: Math.max(3, Math.min(projection.width - width - 3, initial.x + dx)),
        y: Math.max(3, initial.y + dy),
      };
      if (
        !placed.some((other) =>
          intersectBounds(
            {
              x: candidate.x - 2,
              y: candidate.y - 2,
              width: width + 4,
              height: height + 4,
            },
            other,
          ),
        )
      ) {
        box = candidate;
        break;
      }
    }
    box ||= { ...initial, y: Math.max(3, initial.y - 63) };
    placed.push(box);
    if (Math.abs(box.x - initial.x) + Math.abs(box.y - initial.y) > 3) {
      line(
        layer,
        { x: layout.foot.x, y: layout.top + 2 },
        { x: box.x + box.width / 2, y: box.y + height / 2 },
        { class: "iso-label-connector", "pointer-events": "none" },
      );
    }
    const actionable = keys.has(`${cell.r},${cell.c}`);
    const group = svgElement("g", {
      class: `iso-actor-label${isSelected(actor) ? " selected" : ""}`,
      "data-id": id,
      "data-r": cell.r,
      "data-c": cell.c,
      "data-occluded": String(actor.occluded),
      "aria-label": title,
      role: actionable ? "button" : "img",
      tabindex: actionable ? 0 : -1,
      "aria-pressed": String(isSelected(actor)),
      "pointer-events": "all",
    });
    group.appendChild(svgElement("title", {}, title));
    group.appendChild(
      svgElement("rect", {
        x: box.x,
        y: box.y,
        width: tagWidth,
        height,
        rx: 4,
        fill: actor.color,
        stroke: isSelected(actor) ? "#f6ba40" : "#fff9df",
        "stroke-width": isSelected(actor) ? 2.5 : 1,
      }),
    );
    group.appendChild(
      svgElement(
        "text",
        { x: box.x + tagWidth / 2, y: box.y + 12.7, "text-anchor": "middle" },
        text,
      ),
    );
    icons.forEach((kind, index) =>
      stateIcon(group, kind, box.x + tagWidth + 3 + index * 21, box.y),
    );
    bind(group, cell);
    layer.appendChild(group);
  }
}
