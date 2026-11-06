import { TILE_TYPES } from "../config/constants.js";
import { els, setMapDefinition, state } from "../app/state.js";
import {
  createEmptyMapDefinition,
  cloneMapDefinition,
  getTilePlacementPlan,
  setLegacyTileAt,
} from "../domain/map/mapModel.js";
import { getFeaturePositionsByKind, getTileTypeAt } from "../domain/map/mapQueries.js";
import { encodeMapDefinition } from "../domain/map/mapCodec.js";
import { renderTileIcon } from '../ui/board/storybookArt.js';
import { persistCurrentMap, getCurrentMapId, getCurrentMapName, getMapList, updateModeIndicatorForEditor } from "../storage/mapRepository.js";
import { createMapUpgradeDraft, beginMapUpgrade, completeMapUpgrade } from "../domain/map/mapUpgrade.js";
import { usesRampRules } from "../domain/map/mapCompatibility.js";
import { BRIDGE_DIRECTIONS, getBridgeConnectionMask, isBridgeTileType, isRampTileType } from "../domain/map/bridgeTopology.js";
import { renderBridgePanel } from "../ui/editor/bridgePanelRenderer.js";
import { validateMapDefinition } from "../domain/rules/mapValidation.js";
import {
  getBoardCellElement,
  renderBoard,
  syncBoardCell,
  syncBoardTerrain,
} from "../ui/board/boardRenderer.js";
import { renderPalette, updatePaletteRequirementStatus } from "../ui/editor/editorRenderer.js";

const EDITOR_CELL_ID_PREFIX = "editor-cell";
const PLACEMENT_PREVIEW_CLASSES = [
  "placement-preview",
  "placement-valid",
  "placement-invalid",
  "placement-center",
];

let pointerStateBound = false;
let placementPreviewStateBound = false;
let historyMap = null;
let stroke = null;
let paletteRuleset = null;
const undoStack = [];
const redoStack = [];
const HISTORY_LIMIT = 50;

function syncHistoryButtons() {
  els.btnUndoMap.disabled = undoStack.length === 0;
  els.btnRedoMap.disabled = redoStack.length === 0;
}

function recordEdit(before, { reviewed = false } = {}) {
  if (JSON.stringify(before) === JSON.stringify(state.mapDefinition)) return;
  if (state.mapDefinition.upgrade && !reviewed) state.mapDefinition.upgrade.status = "editing";
  undoStack.push(before);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
  persistCurrentMap();
  syncHistoryButtons();
  refreshBridgePanel();
}

function finishStroke(event) {
  if (!stroke || (event?.pointerId !== undefined && event.pointerId !== stroke.pointerId)) return;
  const finished = stroke;
  stroke = null;
  if (finished.map === state.mapDefinition) recordEdit(finished.before);
  clearPlacementPreview();
}

function restoreHistory(from, to) {
  finishStroke();
  if (state.mode !== "EDITOR" || from.length === 0) return;
  to.push(cloneMapDefinition(state.mapDefinition));
  setMapDefinition(from.pop());
  historyMap = state.mapDefinition;
  renderEditorBoard();
  persistCurrentMap();
}

export function undoMap() { restoreHistory(undoStack, redoStack); }
export function redoMap() { restoreHistory(redoStack, undoStack); }

function paintStrokeTo(r, c) {
  if (!stroke || state.mode !== "EDITOR" || stroke.map !== state.mapDefinition) return;
  const previous = stroke.last || { r, c };
  const steps = Math.max(Math.abs(r - previous.r), Math.abs(c - previous.c), 1);
  for (let step = 1; step <= steps; step += 1) {
    paintPlacement(
      Math.round(previous.r + (r - previous.r) * step / steps),
      Math.round(previous.c + (c - previous.c) * step / steps),
    );
  }
  stroke.last = { r, c };
}

function bindPointerState() {
  if (pointerStateBound) return;

  document.addEventListener("pointerup", finishStroke);
  document.addEventListener("pointercancel", finishStroke);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) finishStroke();
  });
  window.addEventListener?.("blur", () => finishStroke());
  els.editorBoard.addEventListener("lostpointercapture", finishStroke);
  els.editorBoard.addEventListener("pointermove", (event) => {
    if (!stroke || event.pointerId !== stroke.pointerId) return;
    if (event.pointerType === "mouse" && event.buttons === 0) { finishStroke(); return; }
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest(".cell");
    if (!cell || !els.editorBoard.contains(cell)) { stroke.last = null; return; }
    paintStrokeTo(Number(cell.dataset.r), Number(cell.dataset.c));
  });
  document.addEventListener("keydown", (event) => {
    if (state.mode !== "EDITOR" || event.altKey) return;
    const target = event.target;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable) return;
    if ([els.rulesModal, els.shareLinkModal, els.victoryModal].some((modal) => !modal.classList.contains("hidden"))) return;
    const key = event.key.toLowerCase();
    if (key === "r" && !event.ctrlKey && !event.metaKey && usesRampRules(state.mapDefinition)) {
      event.preventDefault();
      document.getElementById("btn-rotate-ramp")?.click();
      return;
    }
    if (!(event.ctrlKey || event.metaKey)) return;
    if (key !== "z" && key !== "y") return;
    event.preventDefault();
    if (key === "y" || event.shiftKey) redoMap(); else undoMap();
  });

  pointerStateBound = true;
}

function getRequiredPaletteStatus() {
  return {
    POLICE_SPAWN: state.mapDefinition.spawns.police.length > 0,
    THIEF_SPAWN: state.mapDefinition.spawns.thief.length > 0,
    THIEF_BASE: getFeaturePositionsByKind(state.mapDefinition, "THIEF_BASE").length > 0,
    BANK: getFeaturePositionsByKind(state.mapDefinition, "BANK").length > 0,
  };
}

function syncPaletteRequirementStatus() {
  updatePaletteRequirementStatus(els.palette, getRequiredPaletteStatus());
}

function clearPlacementPreview() {
  document.querySelectorAll(".bridge-preview-edge").forEach((edge) => edge.remove());
  document.querySelectorAll(".placement-ghost").forEach((ghost) => {
    if (ghost.parentNode) {
      ghost.parentNode.removeChild(ghost);
    }
  });
  document.querySelectorAll(".placement-preview").forEach((cell) => {
    cell.classList.remove(...PLACEMENT_PREVIEW_CLASSES);
  });
}

function bindPlacementPreviewState() {
  if (placementPreviewStateBound) return;

  els.editorBoard.addEventListener("pointerleave", clearPlacementPreview);
  placementPreviewStateBound = true;
}

function getUniquePlacementPositions(positions) {
  const seen = new Set();
  return positions.filter((position) => {
    const key = `${position.r},${position.c}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getPreviewTileTypeAt(plan, position) {
  return plan.placements.find(
    (placement) => placement.r === position.r && placement.c === position.c,
  )?.tileType;
}

function createPlacementGhost(tileType) {
  const ghost = document.createElement("span");
  ghost.className = `placement-ghost type-${tileType}`;
  ghost.setAttribute("aria-hidden", "true");

  renderTileIcon(ghost, tileType);

  return ghost;
}

function renderPlacementPreview(plan, centerPosition) {
  clearPlacementPreview();

  const stateClass = plan.canPlace ? "placement-valid" : "placement-invalid";
  plan.previewPositions.forEach((position) => {
    const cell = getBoardCellElement(EDITOR_CELL_ID_PREFIX, position.r, position.c);
    if (!cell) return;

    cell.classList.add("placement-preview", stateClass);
    const previewTileType = getPreviewTileTypeAt(plan, position);
    if (previewTileType) {
      cell.appendChild(createPlacementGhost(previewTileType));
    }
    if (position.r === centerPosition.r && position.c === centerPosition.c) {
      cell.classList.add("placement-center");
    }
  });
  if (plan.canPlace && usesRampRules(state.mapDefinition) && isBridgeTileType(state.currentPaletteType)) {
    const preview = cloneMapDefinition(state.mapDefinition);
    setLegacyTileAt(preview, centerPosition.r, centerPosition.c, state.currentPaletteType);
    const mask = getBridgeConnectionMask(preview, centerPosition.r, centerPosition.c);
    const cell = getBoardCellElement(EDITOR_CELL_ID_PREFIX, centerPosition.r, centerPosition.c);
    BRIDGE_DIRECTIONS.forEach(({ direction }, index) => {
      const edge = document.createElement("span");
      edge.className = `bridge-preview-edge edge-${direction} ${mask & (1 << index) ? "connected" : "closed"}`;
      edge.setAttribute("aria-hidden", "true");
      cell?.appendChild(edge);
    });
  }
}

function syncPlacementCells(plan, fallbackPosition) {
  syncBoardTerrain(els.editorBoard, state.mapDefinition);
  const positions = getUniquePlacementPositions(
    plan.placements.length > 0
      ? plan.placements
      : [fallbackPosition],
  );

  positions.forEach((position) => {
    const cell = getBoardCellElement(EDITOR_CELL_ID_PREFIX, position.r, position.c);
    if (!cell) return;

    syncBoardCell({
      element: cell,
      mapDefinition: state.mapDefinition,
      r: position.r,
      c: position.c,
      cellIdPrefix: EDITOR_CELL_ID_PREFIX,
    });
  });
}

function getCurrentPlacementPlan(r, c) {
  return getTilePlacementPlan(state.mapDefinition, r, c, state.currentPaletteType);
}

function previewPlacement(r, c) {
  renderPlacementPreview(getCurrentPlacementPlan(r, c), { r, c });
}

function paintPlacement(r, c) {
  const plan = getCurrentPlacementPlan(r, c);
  renderPlacementPreview(plan, { r, c });
  if (!plan.canPlace) return false;

  if (getTileTypeAt(state.mapDefinition, r, c) === state.currentPaletteType) {
    return true;
  }

  clearPlacementPreview();
  setLegacyTileAt(state.mapDefinition, r, c, state.currentPaletteType);
  syncPlacementCells(plan, { r, c });
  syncPaletteRequirementStatus();
  renderPlacementPreview(getCurrentPlacementPlan(r, c), { r, c });
  return true;
}

function syncEditorPalette(force = false) {
  const rampRules = usesRampRules(state.mapDefinition);
  if (!force && paletteRuleset === rampRules) return;
  paletteRuleset = rampRules;
  if (!rampRules && isRampTileType(state.currentPaletteType)) state.currentPaletteType = "ROAD";
  renderPalette(els.palette, {
    tileTypes: Object.values(TILE_TYPES).filter((tileType) => !tileType.hiddenFromPalette && (rampRules || !isRampTileType(tileType.id))),
    currentPaletteType: state.currentPaletteType,
    rampRules,
    onSelect(typeId, item) {
      clearPlacementPreview();
      document.querySelectorAll(".palette-item").forEach((paletteItem) => {
        paletteItem.classList.remove("active");
        paletteItem.setAttribute("aria-pressed", "false");
      });
      item.classList.add("active");
      item.setAttribute("aria-pressed", "true");
      state.currentPaletteType = typeId;
    },
  });
}

function refreshBridgePanel() {
  renderBridgePanel(els.bridgePanel, {
    mapDefinition: state.mapDefinition,
    onUpgrade: createUpgradeCopy,
    onComplete: finishMapUpgrade,
    onInspect(position) {
      els.editorBoard.querySelectorAll(".bridge-inspection").forEach((cell) => cell.classList.remove("bridge-inspection"));
      const cell = getBoardCellElement(EDITOR_CELL_ID_PREFIX, position.r, position.c);
      cell?.classList.add("bridge-inspection");
      cell?.scrollIntoView?.({ block: "nearest" });
    },
  });
}

export function createUpgradeCopy() {
  finishStroke();
  if (usesRampRules(state.mapDefinition)) return;
  const encodedMap = encodeMapDefinition(state.mapDefinition);
  const saved = getMapList().find((map) => map.id === getCurrentMapId());
  if (!saved || saved.encodedMap !== encodedMap) persistCurrentMap();
  const name = getCurrentMapName() || "地图";
  let draft = createMapUpgradeDraft({ encodedMap, mapId: getCurrentMapId(), name });
  if (draft.upgrade.status === "pending") draft = beginMapUpgrade(draft);
  const names = new Set(getMapList().map((map) => map.name));
  const base = `${name}（上下桥版）`;
  let nextName = base;
  for (let index = 2; names.has(nextName); index += 1) nextName = `${name}（上下桥版${index}）`;
  setMapDefinition(draft);
  persistCurrentMap({ forceNewMap: true, mapName: nextName });
  renderEditorBoard();
  updateModeIndicatorForEditor();
}

export function finishMapUpgrade() {
  finishStroke();
  if (!state.mapDefinition.upgrade) return false;
  const result = completeMapUpgrade(state.mapDefinition);
  if (!result.valid) {
    alert(`升级尚未完成：\n${result.errors.join("\n")}`);
    return false;
  }
  const before = cloneMapDefinition(state.mapDefinition);
  setMapDefinition(result.mapDefinition);
  historyMap = state.mapDefinition;
  recordEdit(before, { reviewed: true });
  renderEditorBoard();
  return true;
}

export function initEditor() {
  bindPointerState();
  bindPlacementPreviewState();
  syncEditorPalette(true);
  syncPaletteRequirementStatus();

  els.btnClearMap.addEventListener("click", clearMap);
  els.btnUndoMap.addEventListener("click", undoMap);
  els.btnRedoMap.addEventListener("click", redoMap);
}

export function renderEditorBoard() {
  syncEditorPalette();
  if (historyMap !== state.mapDefinition) {
    stroke = null;
    undoStack.length = 0;
    redoStack.length = 0;
    historyMap = state.mapDefinition;
  }
  renderBoard(els.editorBoard, {
    mapDefinition: state.mapDefinition,
    cellIdPrefix: EDITOR_CELL_ID_PREFIX,
    bindCell(cell, { r, c }) {
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.addEventListener("pointerdown", (event) => {
        if (state.mode !== "EDITOR" || event.button !== 0 || event.isPrimary === false || stroke) return;
        event.preventDefault();
        stroke = { pointerId: event.pointerId, before: cloneMapDefinition(state.mapDefinition), map: state.mapDefinition, last: null };
        els.editorBoard.setPointerCapture?.(event.pointerId);
        paintStrokeTo(r, c);
      });
      cell.addEventListener("pointerenter", (event) => {
        if (!stroke && event.pointerType !== "touch") previewPlacement(r, c);
      });
      // Match pointerenter: a compatibility mouseleave can arrive after the
      // next cell's pointerenter and would erase that cell's fresh preview.
      cell.addEventListener("pointerleave", clearPlacementPreview);
    },
  });
  syncPaletteRequirementStatus();
  syncHistoryButtons();
  refreshBridgePanel();
}

export function clearMap() {
  if (!confirm("确定要清空地图吗？所有地块将被重置为普通道路。")) return;

  finishStroke();
  const before = cloneMapDefinition(state.mapDefinition);
  setMapDefinition(createEmptyMapDefinition({ ruleset: before.ruleset, ...(before.upgrade ? { upgrade: before.upgrade } : {}) }));
  historyMap = state.mapDefinition;
  recordEdit(before);
  renderEditorBoard();
}

export function validateMap() {
  const result = validateMapDefinition(state.mapDefinition);
  if (!result.valid) alert(`这张地图还不能开始游戏：\n${result.errors.join("\n")}`);
  return result.valid;
}
