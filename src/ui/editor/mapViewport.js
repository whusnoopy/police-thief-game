import { els } from "../../app/state.js";
import { getMapDimensions } from "../../domain/map/mapDimensions.js";

let pan = false, cellSize = null, dimensions = { rows: 10, cols: 10 }, key = "", drag = null, fit = false, initialized = false;
export function editorIsPanning() { return pan; }
export function showEditorPosition(r, c) {
  if (els.editorMapPosition) els.editorMapPosition.textContent = `第 ${r + 1} 行，第 ${c + 1} 列`;
}
function applySize() {
  if (!els.editorMapViewport) return;
  if (fit) cellSize = Math.max(8, Math.min(60, ((els.editorMapViewport.clientWidth || 608) - 8) / dimensions.cols, ((els.editorMapViewport.clientHeight || 608) - 8) / dimensions.rows));
  els.editorBoard.style.setProperty?.("--editor-cell-size", `${cellSize}px`);
  els.editorBoard.style.width = `${dimensions.cols * cellSize + 8}px`;
  els.editorBoard.style.height = `${dimensions.rows * cellSize + 8}px`;
  if (els.editorMapSize) els.editorMapSize.textContent = `${dimensions.rows}×${dimensions.cols}${dimensions.rows === 20 ? " · 376 格" : ""} · ${Math.round(cellSize / 48 * 100)}%`;
}
export function syncEditorViewport(map, reset = false) {
  dimensions = getMapDimensions(map);
  if (reset || key !== `${dimensions.rows}x${dimensions.cols}` || cellSize === null) {
    key = `${dimensions.rows}x${dimensions.cols}`;
    fit = dimensions.rows === 10;
    cellSize = dimensions.rows > 10 ? 48 : Math.min(60, ((els.editorMapViewport?.clientWidth || 608) - 8) / dimensions.cols);
    if (els.editorMapViewport) { els.editorMapViewport.scrollLeft = 0; els.editorMapViewport.scrollTop = 0; }
  }
  applySize();
}
export function initEditorViewport(beforePan) {
  if (!els.editorMapViewport || initialized) return;
  initialized = true;
  const viewport = els.editorMapViewport;
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => { if (fit) applySize(); }).observe(viewport);
  const mode = value => {
    beforePan(); pan = value;
    viewport.classList.toggle("map-pan-mode", pan);
    els.btnEditorPan.setAttribute("aria-pressed", String(pan));
    els.btnEditorPaint.setAttribute("aria-pressed", String(!pan));
  };
  els.btnEditorPaint.onclick = () => mode(false);
  els.btnEditorPan.onclick = () => mode(true);
  els.btnEditorZoomIn.onclick = () => { beforePan(); fit = false; cellSize = Math.min(80, cellSize + 8); applySize(); };
  els.btnEditorZoomOut.onclick = () => { beforePan(); fit = false; cellSize = Math.max(16, cellSize - 8); applySize(); };
  els.btnEditorFit.onclick = () => { beforePan(); fit = true; applySize(); viewport.scrollLeft = viewport.scrollTop = 0; mode(true); };
  els.btnEditorDetail.onclick = () => { beforePan(); fit = false; cellSize = 48; applySize(); };
  viewport.addEventListener("pointerdown", e => {
    if (!pan || e.pointerType !== "mouse" || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, left: viewport.scrollLeft, top: viewport.scrollTop, id: e.pointerId };
    viewport.setPointerCapture?.(e.pointerId); e.preventDefault();
  });
  viewport.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    viewport.scrollLeft = drag.left - e.clientX + drag.x;
    viewport.scrollTop = drag.top - e.clientY + drag.y;
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) viewport.addEventListener(type, () => { drag = null; });
}
