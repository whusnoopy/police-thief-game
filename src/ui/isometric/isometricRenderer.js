import { getMapDimensions } from "../../domain/map/mapDimensions.js";
import { TILE_TYPES } from "../../config/constants.js";
import { BRIDGE_DIRECTIONS, isBridgeTileType } from "../../domain/map/bridgeTopology.js";
import { appendParkedCar, appendUnitToken } from "../game/unitRenderer.js";
import { appendSprite } from "../board/storybookArt.js";
import { createIsometricScene } from "./sceneModel.js";
import { createIsometricProjection, pickSurface, projectPoint, projectSurfacePoint } from "./projection.js";

import { SCENERY_ASSETS } from "./assetMetadata.js";
import { svgElement, polygon, line } from "./artPrimitives.js";
import { renderScenery, renderSceneryShadow } from "./sceneryArt.js";
import { renderGround, renderBridgeDeck, renderBridgeRails, renderBridgeShadow } from "./terrainArt.js";
import { appendVehicleArtwork } from "./vehicleArt.js";
import { renderCrosswalkSignal } from "./signalArt.js";
import { getActorLayout } from "./actorLayout.js";
import { createActorRecord, rebuildOcclusion, renderActorLabels, updateOutlineSelection } from "./occlusionLayer.js";
import { pickOccludedActor, readOpaqueGeometry } from "./occlusionGeometry.js";

let nextSceneId = 0;
const DETAIL_TILE_WIDTH = 112;

function billboard(parent, { x, y }, width, height, className) {
  const foreignObject = svgElement("foreignObject", { x: x - width / 2, y: y - height, width, height, class: className });
  const content = document.createElement("div");
  content.className = "iso-billboard";
  foreignObject.appendChild(content);
  parent.appendChild(foreignObject);
  return { content, foreignObject };
}

export function createIsometricGameView(container, { viewState, onCellClick, onCellHover, onLeave, unitDirections, vehicleDirections }) {
  let projection = createIsometricProjection();
  let scene, svg, viewport, stage, overlay, resizeObserver, geometry, defs, outlines, labels;
  let cellMap = new Map();
  let records = [], actors = [], disposed = false, refreshPending = false, frameId = null;
  let selectable = [], reachable = [], selected = null, path = [], lastHover = null;
  let pointerType = "mouse", drag = null, suppressClick = false;
  let touchPress = null;
  const unitHitTargets = new WeakMap();

  function visibleCentre() {
    // Resizing can clamp native scroll offsets before ResizeObserver runs. Keep
    // the saved map centre until the new viewport geometry has been installed.
    if (!geometry || geometry.viewWidth !== (viewport.clientWidth || projection.width) || geometry.viewHeight !== (viewport.clientHeight || projection.height)) {
      return { x: viewState.centerX ?? projection.width / 2, y: viewState.centerY ?? projection.height / 2 };
    }
    return {
      x: ((viewport.scrollLeft || 0) + geometry.viewWidth / 2 - geometry.left) / geometry.scale,
      y: ((viewport.scrollTop || 0) + geometry.viewHeight / 2 - geometry.top) / geometry.scale,
    };
  }

  function rememberCentre() {
    const centre = visibleCentre();
    viewState.centerX = centre.x;
    viewState.centerY = centre.y;
  }

  function fitScene(centre = visibleCentre()) {
    if (!svg) return;
    const viewWidth = viewport.clientWidth || projection.width;
    const viewHeight = viewport.clientHeight || projection.height;
    const fit = Math.min(viewWidth / projection.width, viewHeight / projection.height);
    const scale = fit * viewState.zoom;
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
    rememberCentre();
  }

  function preferredKeys() {
    return new Set([...selectable, ...reachable, ...(selected ? [selected] : [])].map(({ r, c }) => `${r},${c}`));
  }
  function scenePoint(event) {
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return { x: (event.clientX - rect.left) * projection.width / rect.width, y: (event.clientY - rect.top) * projection.height / rect.height };
  }
  function eventCell(event) {
    const point = scenePoint(event);
    // Resolve the precise finger position before the browser's click adjustment.
    const target = event.pointerType !== "mouse" && point && typeof document.elementFromPoint === "function"
      ? document.elementFromPoint(event.clientX, event.clientY) : event.target;
    for (let element = target; element && element !== viewport; element = element.parentNode) {
      const hit = unitHitTargets.get(element);
      if (!hit) continue;
      const exactBody = hit.actor && (hit.actor.layout.vehicle || hit.actor.alpha?.status === "ready");
      if (point && exactBody && !hit.actor.contains(point)) continue;
      return hit.cell;
    }
    if (!point) return null;
    return pickOccludedActor(point, actors, preferredKeys()) || pickSurface(point, scene.cells, preferredKeys());
  }
  function bindActorTarget(element, cell, actor = null) {
    unitHitTargets.set(element, { cell, actor });
    element.addEventListener("click", (event) => { event.stopPropagation(); clickCell(actor ? eventCell(event) : cell, event); });
    element.addEventListener("mouseenter", event => {
      const hovered = actor ? eventCell(event) : cell;
      if (hovered) onCellHover(hovered.r, hovered.c);
    });
    element.addEventListener("mouseleave", onLeave);
    if (!actor) element.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault(); clickCell(cell, { pointerType: "mouse" });
    });
  }
  function refreshActorPresentation() {
    if (!labels) return;
    updateOutlineSelection(actors, selected);
    renderActorLabels(labels, actors, projection, selected, preferredKeys(), bindActorTarget);
  }
  function refreshOcclusion() {
    if (disposed || !outlines) return;
    rebuildOcclusion(defs, outlines, actors, records, selected);
    refreshActorPresentation();
  }
  function cancelScheduledOcclusion() {
    if (frameId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(frameId);
    }
    frameId = null;
    refreshPending = false;
  }
  function scheduleOcclusion() {
    if (disposed || refreshPending) return;
    refreshPending = true;
    const refresh = () => { frameId = null; refreshPending = false; refreshOcclusion(); };
    if (typeof requestAnimationFrame === "function") frameId = requestAnimationFrame(refresh);
    else refresh();
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
    const input = event.pointerType || pointerType;
    if ((input === "touch" || input === "pen") && touchPress) cell = touchPress.cell;
    touchPress = null;
    pointerType = "mouse";
    if (!cell || suppressClick) return;
    onCellClick(cell.r, cell.c, { previewOnly: input === "touch" || input === "pen" });
  }
  function drawHighlights() {
    if (!overlay) return;
    overlay.innerHTML = "";
    for (const [positions, className] of [[selectable, "selectable-unit"], [reachable, "reachable"], [selected ? [selected] : [], "unit-selected"], [path, "path-hover"]]) {
      for (const position of positions) {
        const cell = cellMap.get(`${position.r},${position.c}`);
        if (cell) polygon(overlay, cell.polygon, { class: `iso-highlight ${className}`, "data-r": cell.r, "data-c": cell.c });
      }
    }
    // A teleport is a separate jump; never draw a straight walk through obstacles.
    let previous = selected ? cellMap.get(`${selected.r},${selected.c}`) : null;
    for (const position of path) {
      const cell = cellMap.get(`${position.r},${position.c}`);
      if (!cell) continue;
      if (previous && Math.abs(previous.r - cell.r) + Math.abs(previous.c - cell.c) === 1) {
        const edge = projectSurfacePoint(previous, (cell.r - previous.r) / 2, (cell.c - previous.c) / 2, projection);
        const nextEdge = projectSurfacePoint(cell, (previous.r - cell.r) / 2, (previous.c - cell.c) / 2, projection);
        line(overlay, previous.anchor, edge, { class: "iso-path-line" });
        if (Math.abs(edge.y - nextEdge.y) > 1e-7) line(overlay, edge, nextEdge, { class: "iso-path-line" });
        line(overlay, nextEdge, cell.anchor, { class: "iso-path-line" });
      }
      previous = cell;
    }
    for (const position of path) {
      const cell = cellMap.get(`${position.r},${position.c}`);
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
      cancelScheduledOcclusion();
      for (const actor of actors) actor.unsubscribe();
      records = []; actors = []; disposed = false;
      const prefix = `iso-scene-${++nextSceneId}`;
      container.className = "board iso-board";
      container.style.backgroundImage = "none";
      container.innerHTML = "";
      const dimensions = getMapDimensions(session.mapDefinition);
      projection = createIsometricProjection(dimensions);
      const mapKey = `${dimensions.rows}x${dimensions.cols}`;
      if (viewState.mapKey !== mapKey) {
        viewState.mapKey = mapKey;
        viewState.zoom = 1;
        viewState.centerX = projection.width / 2;
        viewState.centerY = projection.height / 2;
      }
      scene = createIsometricScene(session, projection, { unitDirections, vehicleDirections });
      cellMap = new Map(scene.cells.map((cell) => [`${cell.r},${cell.c}`, cell]));
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
      const shadows = svgElement("g", { class: "iso-shadows", "pointer-events": "none" });
      const objects = svgElement("g", { class: "iso-objects", "pointer-events": "none" });
      overlay = svgElement("g", { class: "iso-overlays", "pointer-events": "none" });
      defs = svgElement("defs");
      outlines = svgElement("g", { class: "iso-occlusions", "pointer-events": "none" });
      labels = svgElement("g", { class: "iso-actor-labels", "pointer-events": "none" });
      svg.append(defs, ground, shadows, objects, overlay, outlines, labels);
      for (const cell of scene.cells) if (!isBridgeTileType(cell.tileType)) renderGround(ground, cell, projection, session);
      for (const cell of scene.objects) {
        if (cell.kind === "scenery") renderSceneryShadow(shadows, cell, projection);
        if (cell.kind === "bridge") renderBridgeShadow(shadows, cell, projection);
      }
      for (const [index, cell] of scene.objects.entries()) {
        const id = `${prefix}-object-${index}`;
        const group = svgElement("g", { class: `iso-object iso-${cell.kind}`, "data-r": cell.r, "data-c": cell.c });
        objects.appendChild(group);
        if (cell.kind !== "unit" && cell.kind !== "car") {
          const art = svgElement("g", { id });
          group.appendChild(art);
          if (cell.kind === "bridge") renderBridgeDeck(art, cell, projection, session.mapDefinition);
          if (cell.kind === "bridge-front") renderBridgeRails(art, cell, projection, session.mapDefinition, true);
          if (cell.kind === "signal") renderCrosswalkSignal(art, cell, projection, session.signalPhase);
          if (cell.kind === "scenery") {
            renderScenery(art, cell, projection, session.mapDefinition);
            group.appendChild(svgElement("text", { x: cell.anchor.x, y: cell.anchor.y + 17, class: "iso-feature-label", "text-anchor": "middle" }, TILE_TYPES[cell.tileType].name));
          }
          records.push({ cell, index, maskId: id, ...readOpaqueGeometry(art) });
          continue;
        }
        const layout = getActorLayout(cell, projection);
        group.setAttribute("data-placement", layout.placement);
        group.setAttribute("data-scale", layout.scale);
        const actor = createActorRecord(defs, cell, layout, projection, id, index, scheduleOcclusion);
        actors.push(actor); records.push(actor);
        const { content, foreignObject } = billboard(group, { x: layout.foot.x, y: layout.top + layout.height }, layout.width, layout.height, "iso-unit-art");
        const artwork = { showBadges: false, appendArtwork: layout.vehicle
          ? container => appendVehicleArtwork(container, cell, projection, cell.direction, cell.side === "police")
          : (container, name, className, label) => {
            const image = appendSprite(container, name, className, label, { url: actor.url });
            image.addEventListener("error", () => { actor.failed = true; scheduleOcclusion(); });
            return image;
          } };
        if (cell.kind === "car") appendParkedCar(content, artwork);
        else appendUnitToken(content, cell.unit, cell.side, artwork);
        foreignObject.setAttribute("pointer-events", "all");
        bindActorTarget(foreignObject, cell, actor);
      }
      refreshOcclusion();
      // Direction cues refer to map north/east, not the screen's up/right.
      for (const { direction, dr, dc, name } of BRIDGE_DIRECTIONS) {
        const pos = projectPoint({ r: (projection.rows - 1) / 2 + dr * (projection.rows / 2 + .4), c: (projection.cols - 1) / 2 + dc * (projection.cols / 2 + .4) }, projection);
        svg.appendChild(svgElement("text", { x: pos.x, y: pos.y, class: "iso-compass", "text-anchor": "middle", "data-direction": direction }, name));
      }
      svg.addEventListener("click", (event) => clickCell(eventCell(event), event));
      svg.addEventListener("mousemove", (event) => {
        if (drag?.moved) return;
        const cell = eventCell(event);
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
        touchPress = null;
        if (pointerType !== "mouse") {
          touchPress = { cell: eventCell(event) };
          return;
        }
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
        rememberCentre();
      });
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) viewport.addEventListener(type, finishDrag);
      viewport.addEventListener("pointercancel", () => { touchPress = null; });
      viewport.addEventListener("scroll", rememberCentre, { passive: true });
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
    clearHighlights() { selectable = []; reachable = []; selected = null; path = []; drawHighlights(); refreshActorPresentation(); },
    setSelectable(positions) { selectable = positions; drawHighlights(); refreshActorPresentation(); },
    setReachable(positions) { reachable = positions; drawHighlights(); refreshActorPresentation(); },
    setSelected(position) { selected = position; drawHighlights(); refreshActorPresentation(); },
    setPath(segments) { path = segments; drawHighlights(); },
    clearPath() { path = []; drawHighlights(); },
    setZoom(zoom) {
      const centre = visibleCentre();
      viewState.zoom = Math.min(projection.rows > 10 ? 5 : 2.5, Math.max(1, zoom));
      fitScene(viewState.zoom === 1 ? { x: projection.width / 2, y: projection.height / 2 } : centre);
    },
    focusCell(position) {
      const cell = cellMap.get(`${position.r},${position.c}`);
      if (!cell) return;
      const fit = Math.min((viewport.clientWidth || projection.width) / projection.width, (viewport.clientHeight || projection.height) / projection.height);
      const detail = projection.rows > 10 ? DETAIL_TILE_WIDTH / projection.tileWidth : 1;
      viewState.zoom = Math.max(viewState.zoom, Math.min(projection.rows > 10 ? 5 : 2.5, detail / fit));
      fitScene(cell.anchor);
    },
    dispose() {
      disposed = true;
      cancelScheduledOcclusion();
      for (const actor of actors) actor.unsubscribe();
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
