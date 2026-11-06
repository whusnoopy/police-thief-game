import { SIGNAL_PHASES, TILE_TYPES } from "../../config/constants.js";
import { BRIDGE_DIRECTIONS, getBridgeConnectionMask, getRampDirection, isBridgeTileType } from "../../domain/map/bridgeTopology.js";
import { isCrosswalkTileType } from "../../domain/map/crosswalk.js";
import { appendSprite, TILE_ASSETS } from "../board/storybookArt.js";
import { appendParkedCar, appendUnitToken } from "../game/unitRenderer.js";
import { createIsometricScene } from "./sceneModel.js";
import { createIsometricProjection, pickSurface, projectPoint, projectSurfacePoint } from "./projection.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const COLORS = { ROAD: "#ded8c6", GRASS: "#b7cea0", RIVER: "#8dbfc8", OVERPASS: "#b8c4c1", MOUNTAIN: "#b5c79b", PARKING: "#d5d5be" };
const OBJECT_HEIGHTS = { MOUNTAIN: 108, BUILDING: 94, CONSTRUCTION_SITE: 80, BARRIER: 46, BANK: 88, POLICE_STATION: 92, THIEF_BASE: 84, FARM: 82 };

function svgElement(tag, attributes = {}, text = null) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text !== null) element.textContent = text;
  return element;
}

function points(polygon) { return polygon.map(({ x, y }) => `${x},${y}`).join(" "); }
function polygon(parent, vertices, attributes = {}) {
  const element = svgElement("polygon", { points: points(vertices), ...attributes });
  parent.appendChild(element);
  return element;
}
function line(parent, a, b, attributes = {}) {
  parent.appendChild(svgElement("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, ...attributes }));
}

function renderSurface(parent, cell, projection, session) {
  const type = cell.tileType;
  const bridge = isBridgeTileType(type);
  const group = svgElement("g", { class: "iso-surface", "data-r": cell.r, "data-c": cell.c });
  parent.appendChild(group);
  const surface = polygon(group, cell.polygon, { fill: bridge ? COLORS.OVERPASS : COLORS[type] || COLORS.ROAD, stroke: "#64745c50", "stroke-width": 0.8 });
  surface.appendChild(svgElement("title", {}, `第 ${cell.r + 1} 行 ${cell.c + 1} 列，${TILE_TYPES[type].name}`));
  const at = (r, c) => projectSurfacePoint(cell, r, c, projection);
  if (isCrosswalkTileType(type)) {
    for (let offset = -0.4; offset < 0.45; offset += 0.2) {
      const vertices = type === "CROSSWALK_HORIZONTAL"
        ? [[-0.42, offset], [-0.42, offset + 0.1], [0.42, offset + 0.1], [0.42, offset]]
        : [[offset, -0.42], [offset, 0.42], [offset + 0.1, 0.42], [offset + 0.1, -0.42]];
      polygon(group, vertices.map(([r, c]) => at(r, c)), { fill: "#fffdf3" });
    }
    for (const sign of [-1, 1]) {
      const position = type === "CROSSWALK_VERTICAL" ? at(sign * 0.4, 0) : at(0, sign * 0.4);
      const green = session.signalPhase === SIGNAL_PHASES.PEDESTRIAN_GREEN;
      group.appendChild(svgElement("circle", { cx: position.x, cy: position.y, r: 4, fill: green ? "#2eae61" : "#d85e4d", stroke: "#fff", "stroke-width": 1.5, class: `iso-signal ${green ? "green" : "red"}` }));
    }
  }
  if (type === "RIVER") {
    for (const r of [-0.25, 0.15]) line(group, at(r, -0.3), at(r, 0.3), { stroke: "#c8e5e4", "stroke-width": 2 });
  }
  const marker = { POLICE_SPAWN: "P", THIEF_SPAWN: "T", PARKING: "P", MANHOLE: "◎", TRAFFIC_LIGHT: "●" }[type];
  if (marker) {
    const position = at(0, 0);
    group.appendChild(svgElement("text", { x: position.x, y: position.y + 5, class: `iso-ground-mark mark-${type}`, "text-anchor": "middle" }, marker));
  }
  if (!bridge) return;
  const mask = getBridgeConnectionMask(session.mapDefinition, cell.r, cell.c);
  // N/E/S/W edges in the polygon. Solid plinths avoid suggesting a road below.
  const edgeIndices = [[0, 1], [1, 2], [2, 3], [3, 0]];
  edgeIndices.forEach(([a, b], index) => {
    if (!(mask & (1 << index))) line(group, cell.polygon[a], cell.polygon[b], { stroke: "#596e76", "stroke-width": 3 });
  });
  const ramp = getRampDirection(type);
  if (ramp) {
    const low = at(-ramp.dr * 0.3, -ramp.dc * 0.3);
    const high = at(ramp.dr * 0.3, ramp.dc * 0.3);
    line(group, low, high, { stroke: "#355360", "stroke-width": 2.5 });
    const angle = Math.atan2(high.y - low.y, high.x - low.x);
    for (const delta of [-0.55, 0.55]) line(group, high, { x: high.x - 8 * Math.cos(angle + delta), y: high.y - 8 * Math.sin(angle + delta) }, { stroke: "#355360", "stroke-width": 2.5 });
    group.appendChild(svgElement("title", {}, `向${ramp.name}上桥，反向下桥`));
  }
}

function renderBridge(parent, cell, projection, session) {
  const ground = [[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0.5, -0.5]]
    .map(([r, c]) => projectPoint({ r: cell.r + r, c: cell.c + c }, projection));
  for (const [a, b, fill] of [[1, 2, "#879b9d"], [2, 3, "#9bada8"]]) {
    polygon(parent, [cell.polygon[a], cell.polygon[b], ground[b], ground[a]], { fill, stroke: "#718788", "stroke-width": 0.6 });
  }
  renderSurface(parent, cell, projection, session);
}

function billboard(parent, { x, y }, width, height, className) {
  const foreignObject = svgElement("foreignObject", { x: x - width / 2, y: y - height, width, height, class: className });
  const content = document.createElement("div");
  content.className = "iso-billboard";
  foreignObject.appendChild(content);
  parent.appendChild(foreignObject);
  return { content, foreignObject };
}

export function createIsometricGameView(container, { viewState, onCellClick, onCellHover, onLeave }) {
  const projection = createIsometricProjection();
  let scene, svg, viewport, stage, overlay, resizeObserver, geometry;
  let selectable = [], reachable = [], selected = null, path = [], lastHover = null;
  let pointerType = "mouse", drag = null, suppressClick = false;
  const unitHitTargets = new WeakMap();

  function visibleCentre() {
    if (!geometry) return { x: viewState.centerX ?? projection.width / 2, y: viewState.centerY ?? projection.height / 2 };
    return {
      x: ((viewport.scrollLeft || 0) + geometry.viewWidth / 2 - geometry.left) / geometry.scale,
      y: ((viewport.scrollTop || 0) + geometry.viewHeight / 2 - geometry.top) / geometry.scale,
    };
  }

  function fitScene(centre = visibleCentre()) {
    if (!svg) return;
    const viewWidth = viewport.clientWidth || projection.width;
    const viewHeight = viewport.clientHeight || projection.height;
    const scale = Math.min(viewWidth / projection.width, viewHeight / projection.height) * viewState.zoom;
    const width = projection.width * scale, height = projection.height * scale;
    // Leave half a viewport on each side so even the fitted map can be panned.
    const stageWidth = Math.max(viewWidth, width) + viewWidth;
    const stageHeight = Math.max(viewHeight, height) + viewHeight;
    const left = (stageWidth - width) / 2, top = (stageHeight - height) / 2;
    stage.style.width = `${stageWidth}px`;
    stage.style.height = `${stageHeight}px`;
    svg.style.width = `${width}px`;
    svg.style.height = `${height}px`;
    svg.style.left = `${left}px`;
    svg.style.top = `${top}px`;
    geometry = { viewWidth, viewHeight, scale, left, top };
    viewport.scrollLeft = Math.max(0, Math.min(stageWidth - viewWidth, centre.x * scale + left - viewWidth / 2));
    viewport.scrollTop = Math.max(0, Math.min(stageHeight - viewHeight, centre.y * scale + top - viewHeight / 2));
  }

  function preferredKeys() {
    return new Set([...selectable, ...reachable, ...(selected ? [selected] : [])].map(({ r, c }) => `${r},${c}`));
  }
  function targetAt(event) {
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return pickSurface({ x: (event.clientX - rect.left) * projection.width / rect.width, y: (event.clientY - rect.top) * projection.height / rect.height }, scene.cells, preferredKeys());
  }
  function eventCell(event) {
    for (let element = event.target; element && element !== viewport; element = element.parentNode) {
      const cell = unitHitTargets.get(element);
      if (cell) return cell;
    }
    return targetAt(event);
  }
  function isActionTarget(cell) {
    return !!cell && preferredKeys().has(`${cell.r},${cell.c}`);
  }
  function finishDrag(event) {
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.id)) return;
    const id = drag.id;
    drag = null;
    viewport.classList.remove("is-panning");
    if (viewport.hasPointerCapture?.(id)) viewport.releasePointerCapture(id);
  }
  function clickCell(cell, event) {
    if (!cell || suppressClick) return;
    const input = event.pointerType || pointerType;
    pointerType = "mouse";
    onCellClick(cell.r, cell.c, { previewOnly: input === "touch" || input === "pen" });
  }
  function drawHighlights() {
    if (!overlay) return;
    overlay.innerHTML = "";
    for (const [positions, className] of [[selectable, "selectable-unit"], [reachable, "reachable"], [selected ? [selected] : [], "unit-selected"], [path, "path-hover"]]) {
      for (const position of positions) {
        const cell = scene.cells.find(({ r, c }) => r === position.r && c === position.c);
        if (cell) polygon(overlay, cell.polygon, { class: `iso-highlight ${className}`, "data-r": cell.r, "data-c": cell.c });
      }
    }
    // A teleport is a separate jump; never draw a straight walk through obstacles.
    let previous = selected ? scene.cells.find(({ r, c }) => r === selected.r && c === selected.c) : null;
    for (const position of path) {
      const cell = scene.cells.find(({ r, c }) => r === position.r && c === position.c);
      if (!cell) continue;
      if (previous && Math.abs(previous.r - cell.r) + Math.abs(previous.c - cell.c) === 1) {
        const edge = projectSurfacePoint(previous, (cell.r - previous.r) / 2, (cell.c - previous.c) / 2, projection);
        line(overlay, previous.anchor, edge, { class: "iso-path-line" });
        line(overlay, edge, cell.anchor, { class: "iso-path-line" });
      }
      previous = cell;
    }
    for (const position of path) {
      const cell = scene.cells.find(({ r, c }) => r === position.r && c === position.c);
      if (!cell) continue;
      const { x, y } = cell.anchor;
      const width = Math.max(24, String(position.label).length * 10 + 8);
      const badge = svgElement("g", { class: "iso-step-badge", "data-r": cell.r, "data-c": cell.c });
      badge.appendChild(svgElement("rect", { x: x - width / 2, y: y - 9, width, height: 18, rx: 5 }));
      badge.appendChild(svgElement("text", { x, y: y + 4, "text-anchor": "middle" }, position.label));
      overlay.appendChild(badge);
    }
  }

  return {
    render(session) {
      container.className = "board iso-board";
      container.style.backgroundImage = "none";
      container.innerHTML = "";
      scene = createIsometricScene(session, projection);
      viewport = document.createElement("div");
      viewport.className = "iso-viewport";
      viewport.style.aspectRatio = `${projection.width} / ${projection.height}`;
      viewport.setAttribute("aria-label", "斜视棋盘，可在地图空白或不可点击处按住拖动");
      viewport.setAttribute("tabindex", "0");
      svg = svgElement("svg", { viewBox: `0 0 ${projection.width} ${projection.height}`, width: projection.width, height: projection.height, class: "iso-canvas", "aria-label": "斜视游戏棋盘" });
      stage = document.createElement("div");
      stage.className = "iso-stage";
      stage.appendChild(svg);
      viewport.appendChild(stage);
      container.appendChild(viewport);
      const ground = svgElement("g", { class: "iso-ground", "pointer-events": "none" });
      const objects = svgElement("g", { class: "iso-objects", "pointer-events": "none" });
      overlay = svgElement("g", { class: "iso-overlays", "pointer-events": "none" });
      svg.append(ground, objects, overlay);
      for (const cell of scene.cells) if (!isBridgeTileType(cell.tileType)) renderSurface(ground, cell, projection, session);
      for (const cell of scene.objects) {
        const group = svgElement("g", { class: `iso-object iso-${cell.kind}`, "data-r": cell.r, "data-c": cell.c });
        objects.appendChild(group);
        if (cell.kind === "bridge") { renderBridge(group, cell, projection, session); continue; }
        const feature = !!TILE_ASSETS[cell.tileType];
        const anchor = { x: cell.anchor.x, y: cell.anchor.y + 10 };
        if (cell.kind === "scenery") {
          const height = OBJECT_HEIGHTS[cell.tileType];
          const { content } = billboard(group, anchor, 96, height, "iso-scenery-art");
          appendSprite(content, TILE_ASSETS[cell.tileType], "iso-tile-art", TILE_TYPES[cell.tileType].name);
          group.appendChild(svgElement("text", { x: anchor.x, y: anchor.y + 8, class: "iso-feature-label", "text-anchor": "middle" }, TILE_TYPES[cell.tileType].name));
        } else {
          // Prototype occupancy offset keeps the facility and its occupant legible.
          // Dedicated doorway scaling/driveway anchors belong to the later stage.
          if (feature) { anchor.x += 19; anchor.y += 9; }
          const { content, foreignObject } = billboard(group, anchor, 64, 70, "iso-unit-art");
          unitHitTargets.set(foreignObject, cell);
          if (cell.kind === "car") appendParkedCar(content);
          else appendUnitToken(content, cell.unit, cell.side);
          foreignObject.setAttribute("pointer-events", "all");
          foreignObject.addEventListener("click", (event) => { event.stopPropagation(); clickCell(cell, event); });
          foreignObject.addEventListener("mouseenter", () => onCellHover(cell.r, cell.c));
          foreignObject.addEventListener("mouseleave", onLeave);
        }
      }
      // Direction cues refer to map north/east, not the screen's up/right.
      for (const { direction, dr, dc, name } of BRIDGE_DIRECTIONS) {
        const pos = projectPoint({ r: 4.5 + dr * 5.4, c: 4.5 + dc * 5.4 }, projection);
        svg.appendChild(svgElement("text", { x: pos.x, y: pos.y, class: "iso-compass", "text-anchor": "middle", "data-direction": direction }, name));
      }
      svg.addEventListener("click", (event) => clickCell(targetAt(event), event));
      svg.addEventListener("mousemove", (event) => {
        if (drag?.moved) return;
        const cell = targetAt(event);
        const key = cell ? `${cell.r},${cell.c}` : null;
        if (key === lastHover) return;
        lastHover = key;
        if (cell) onCellHover(cell.r, cell.c); else onLeave();
      });
      svg.addEventListener("mouseleave", () => { lastHover = null; onLeave(); });
      viewport.addEventListener("pointerdown", (event) => {
        if (event.isPrimary === false || (event.pointerType === "mouse" && event.button !== 0)) return;
        pointerType = event.pointerType || "mouse";
        suppressClick = false;
        if (pointerType !== "mouse") return;
        const canPan = !isActionTarget(eventCell(event));
        drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop, id: event.pointerId, moved: false, canPan };
        // Capture blank-space presses immediately, including ones near the edge.
        // A clickable press keeps its original target unless it becomes a drag.
        if (canPan) viewport.setPointerCapture?.(event.pointerId);
      });
      viewport.addEventListener("pointermove", (event) => {
        if (event.pointerType !== "mouse") return;
        viewport.classList.toggle("over-action", isActionTarget(eventCell(event)));
        if (!drag || drag.id !== event.pointerId) return;
        if (event.buttons === 0) { finishDrag(event); return; }
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 6) {
          drag.moved = true;
          suppressClick = true;
          viewport.setPointerCapture?.(event.pointerId);
          viewport.classList.toggle("is-panning", drag.canPan);
          lastHover = null;
          onLeave();
        }
        if (!drag.moved) return;
        event.preventDefault();
        if (!drag.canPan) return;
        viewport.scrollLeft = drag.left - dx;
        viewport.scrollTop = drag.top - dy;
      });
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) viewport.addEventListener(type, finishDrag);
      viewport.addEventListener("click", (event) => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopPropagation();
      }, true);
      fitScene();
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => fitScene());
        resizeObserver.observe(viewport);
      }
      drawHighlights();
    },
    clearHighlights() { selectable = []; reachable = []; selected = null; path = []; drawHighlights(); },
    setSelectable(positions) { selectable = positions; drawHighlights(); },
    setReachable(positions) { reachable = positions; drawHighlights(); },
    setSelected(position) { selected = position; drawHighlights(); },
    setPath(segments) { path = segments; drawHighlights(); },
    clearPath() { path = []; drawHighlights(); },
    setZoom(zoom) {
      const centre = visibleCentre();
      viewState.zoom = Math.min(2.5, Math.max(1, zoom));
      fitScene(viewState.zoom === 1 ? { x: projection.width / 2, y: projection.height / 2 } : centre);
    },
    dispose() {
      if (viewport) {
        const centre = visibleCentre();
        viewState.centerX = centre.x;
        viewState.centerY = centre.y;
      }
      resizeObserver?.disconnect();
      // All listeners belong to the detached subtree; no global listeners remain.
      container.innerHTML = "";
    },
  };
}
