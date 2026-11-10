import { getMapDimensions } from "../domain/map/mapDimensions.js";
import { createMapExpansionDraft, completeMapExpansion } from "../domain/map/mapExpansion.js";
import { initEditorViewport, syncEditorViewport, editorIsPanning, showEditorPosition } from "../ui/editor/mapViewport.js";
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
import { usesRampRules, usesContinuousActions } from "../domain/map/mapCompatibility.js";
import { createActionUpgradeCopy } from "../domain/map/mapActionUpgrade.js";
import { BRIDGE_DIRECTIONS, RAMP_TILE_TYPES, getBridgeConnectionMask, isBridgeTileType, isRampTileType } from "../domain/map/bridgeTopology.js";
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
let editorButtonsBound = false;
let historyMap = null;
let stroke = null;
let paletteRuleset = null;
let paletteShortcutGroup = null;
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
  if (state.mapDefinition.expansion && !reviewed) state.mapDefinition.expansion.status = "editing";
  undoStack.push(before);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
  persistCurrentMap();
  syncHistoryButtons();
  refreshBridgePanel();
  renderExpansionControls();
  renderActionRuleControls();
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

function setPaletteShortcutStage(stage = "", group = null) {
  paletteShortcutGroup = group;
  els.palette.dataset.shortcutStage = stage;
  let hint = "按 T 选择地块";
  if (stage === "group") hint = "按分类编号，Esc 取消";
  if (group) {
    const ramps = group.dataset.group === "bridge-facilities" && usesRampRules(state.mapDefinition);
    hint = `${group.dataset.name}：${ramps ? "按地块编号或方向键，R 轮换" : "按地块编号"}，Esc 取消`;
  }
  els.editorPaletteShortcut.textContent = hint;
}

function cancelPaletteShortcut() {
  if (els.palette.dataset.shortcutStage) setPaletteShortcutStage();
}

function selectPaletteShortcutItem(item) {
  if (!item) return false;
  cancelPaletteShortcut();
  item.closest(".palette-group").open = true;
  item.click();
  return true;
}

function handlePaletteShortcut(key) {
  if (key === "t") {
    setPaletteShortcutStage("group");
    return true;
  }
  if (key === "r" && usesRampRules(state.mapDefinition)) {
    const next = RAMP_TILE_TYPES[(RAMP_TILE_TYPES.indexOf(state.currentPaletteType) + 1) % RAMP_TILE_TYPES.length];
    return selectPaletteShortcutItem(Array.from(els.palette.querySelectorAll(".palette-item")).find(item => item.dataset.type === next));
  }

  const stage = els.palette.dataset.shortcutStage;
  if (!stage) return false;
  const index = /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
  if (stage === "group") {
    const group = els.palette.querySelectorAll(".palette-group")[index];
    if (group) {
      group.open = true;
      setPaletteShortcutStage("tile", group);
      group.scrollIntoView?.({ block: "nearest" });
      return true;
    }
  } else {
    const items = paletteShortcutGroup.querySelectorAll(".palette-item");
    const direction = ["arrowup", "arrowright", "arrowdown", "arrowleft"].indexOf(key);
    if (direction >= 0 && paletteShortcutGroup.dataset.group === "bridge-facilities") {
      const ramp = Array.from(items).find(item => item.dataset.type === RAMP_TILE_TYPES[direction]);
      if (selectPaletteShortcutItem(ramp)) return true;
    }
    if (selectPaletteShortcutItem(items[index])) return true;
  }
  cancelPaletteShortcut();
  return key === "escape";
}

function bindPointerState() {
  if (pointerStateBound) return;

  document.addEventListener("pointerup", finishStroke);
  document.addEventListener("pointercancel", finishStroke);
  document.addEventListener("pointerdown", cancelPaletteShortcut);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) finishStroke();
  });
  window.addEventListener?.("blur", () => {
    finishStroke();
    cancelPaletteShortcut();
  });
  els.editorBoard.addEventListener("lostpointercapture", finishStroke);
  els.editorBoard.addEventListener("pointermove", (event) => {
    if (!stroke || event.pointerId !== stroke.pointerId) return;
    if (event.pointerType === "mouse" && event.buttons === 0) { finishStroke(); return; }
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest(".cell");
    if (!cell || !els.editorBoard.contains(cell)) { stroke.last = null; return; }
    paintStrokeTo(Number(cell.dataset.r), Number(cell.dataset.c));
  });
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const editingText = ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable;
    const modalOpen = [els.rulesModal, els.shareLinkModal, els.victoryModal].some((modal) => !modal.classList.contains("hidden"));
    if (state.mode !== "EDITOR" || event.altKey || event.isComposing || editingText || modalOpen) {
      cancelPaletteShortcut();
      return;
    }
    const key = event.key.toLowerCase();
    if (!event.ctrlKey && !event.metaKey) {
      if (!event.repeat && handlePaletteShortcut(key)) event.preventDefault();
      return;
    }
    cancelPaletteShortcut();
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
  els.editorBoard.querySelectorAll(".bridge-preview-edge").forEach((edge) => edge.remove());
  els.editorBoard.querySelectorAll(".placement-ghost").forEach((ghost) => {
    if (ghost.parentNode) {
      ghost.parentNode.removeChild(ghost);
    }
  });
  els.editorBoard.querySelectorAll(".placement-preview").forEach((cell) => {
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
  showEditorPosition(r, c);
  if (editorIsPanning()) return;
  renderPlacementPreview(getCurrentPlacementPlan(r, c), { r, c });
}

function paintPlacement(r, c) {
  showEditorPosition(r, c);
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
  const continuousRules = usesContinuousActions(state.mapDefinition);
  const paletteKey = `${rampRules}:${continuousRules}`;
  if (!force && paletteRuleset === paletteKey) return;
  cancelPaletteShortcut();
  paletteRuleset = paletteKey;
  if (!rampRules && isRampTileType(state.currentPaletteType)) state.currentPaletteType = "ROAD";
  renderPalette(els.palette, {
    tileTypes: Object.values(TILE_TYPES).filter((tileType) => !tileType.hiddenFromPalette && (rampRules || !isRampTileType(tileType.id))),
    currentPaletteType: state.currentPaletteType,
    rampRules,
    continuousRules,
    onSelect(typeId, item) {
      clearPlacementPreview();
      els.palette.querySelectorAll(".palette-item").forEach((paletteItem) => {
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
  initEditorViewport(() => { finishStroke(); clearPlacementPreview(); });
  bindPointerState();
  bindPlacementPreviewState();
  syncEditorPalette(true);
  syncPaletteRequirementStatus();

  if (editorButtonsBound) return;
  editorButtonsBound = true;
  els.btnRenameCurrentMap.addEventListener("click", renameCurrentMap);
  els.btnClearMap.addEventListener("click", clearMap);
  els.btnUndoMap.addEventListener("click", undoMap);
  els.btnRedoMap.addEventListener("click", redoMap);
}

export function renderEditorBoard() {
  syncEditorPalette();
  if (historyMap !== state.mapDefinition) {
    cancelPaletteShortcut();
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
        if (editorIsPanning() || state.mode !== "EDITOR" || event.button !== 0 || event.isPrimary === false || stroke) return;
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
  syncEditorViewport(state.mapDefinition);
  renderExpansionControls();
  renderActionRuleControls();
}

export function clearMap() {
  if (!confirm("确定要清空地图吗？所有地块将被重置为普通道路。")) return;

  finishStroke();
  const before = cloneMapDefinition(state.mapDefinition);
  setMapDefinition(createEmptyMapDefinition({ meta: before.meta, ruleset: before.ruleset, ...(before.actionRules ? { actionRules: before.actionRules } : {}), ...(before.actionUpgrade ? { actionUpgrade: before.actionUpgrade } : {}), ...(before.expansion ? { expansion: before.expansion } : {}), ...(before.upgrade ? { upgrade: before.upgrade } : {}) }));
  historyMap = state.mapDefinition;
  recordEdit(before);
  renderEditorBoard();
}

function renderExpansionControls() {
  const container = els.mapExpansionControls;
  if (!container) return;
  container.innerHTML = "";
  const addButton = (id, text, action) => {
    const button = document.createElement("button"); button.id = id; button.type = "button";
    button.className = "btn secondary"; button.textContent = text; button.onclick = action; container.appendChild(button);
  };
  if (getMapDimensions(state.mapDefinition).rows === 10) addButton("btn-expand-map", "扩展为 20×20 副本", createExpansionCopy);
  if (state.mapDefinition.expansion) {
    const p = document.createElement("p");
    p.textContent = `原图位于第 6–15 行、6–15 列；新增区域为道路，山边保留草地。原图已保留。${state.mapDefinition.expansion.status === "ready" ? "扩展路线已校验。" : "请检查新增路线并完成校验。"}`;
    container.appendChild(p);
    if (state.mapDefinition.expansion.status !== "ready") addButton("btn-finish-expansion", "校验并完成扩展", finishMapExpansion);
  }
}

export function createExpansionCopy() {
  finishStroke();
  if (getMapDimensions(state.mapDefinition).rows !== 10) return;
  const encodedMap = encodeMapDefinition(state.mapDefinition);
  const saved = getMapList().find(m => m.id === getCurrentMapId());
  if (!saved || saved.encodedMap !== encodedMap) persistCurrentMap();
  const name = getCurrentMapName() || "地图";
  const draft = createMapExpansionDraft({ encodedMap, mapId: getCurrentMapId(), name });
  const names = new Set(getMapList().map(m => m.name));
  let nextName = `${name}（20×20）`;
  for (let n = 2; names.has(nextName); n++) nextName = `${name}（20×20 副本${n}）`;
  setMapDefinition(draft);
  persistCurrentMap({ forceNewMap: true, mapName: nextName });
  renderEditorBoard(); updateModeIndicatorForEditor();
}

export function finishMapExpansion() {
  finishStroke();
  const result = completeMapExpansion(state.mapDefinition);
  if (!result.valid) { alert(`扩展尚未完成：\n${result.errors.join("\n")}`); return false; }
  const before = cloneMapDefinition(state.mapDefinition);
  setMapDefinition(result.mapDefinition); historyMap = state.mapDefinition;
  recordEdit(before, { reviewed: true }); renderEditorBoard(); return true;
}

export function validateMap() {
  const result = validateMapDefinition(state.mapDefinition);
  if (!result.valid) alert(`这张地图还不能开始游戏：\n${result.errors.join("\n")}`);
  return result.valid;
}

function renderActionRuleControls() {
  const container = els.actionRuleControls;
  if (!container) return;
  container.innerHTML = "";
  if (!usesContinuousActions(state.mapDefinition)) {
    const button = document.createElement("button"); button.id = "btn-upgrade-actions";
    button.type = "button"; button.className = "btn secondary"; button.textContent = "创建连续行动副本";
    button.onclick = createContinuousActionCopy; container.appendChild(button);
  }
}

export function createContinuousActionCopy() {
  finishStroke();
  if (usesContinuousActions(state.mapDefinition)) return;
  const encodedMap = encodeMapDefinition(state.mapDefinition);
  const saved = getMapList().find(map => map.id === getCurrentMapId());
  if (!saved || saved.encodedMap !== encodedMap) persistCurrentMap();
  const name = getCurrentMapName() || "地图";
  const map = createActionUpgradeCopy({ encodedMap, mapId: getCurrentMapId(), name });
  const names = new Set(getMapList().map(record => record.name));
  let nextName = `${name}（连续行动）`;
  for (let i = 2; names.has(nextName); i++) nextName = `${name}（连续行动${i}）`;
  setMapDefinition(map); persistCurrentMap({ forceNewMap: true, mapName: nextName });
  renderEditorBoard(); updateModeIndicatorForEditor();
}

export function renameCurrentMap() {
  if (state.mode !== "EDITOR") return;
  finishStroke();
  const name = prompt("请输入地图名称:", getCurrentMapName());
  if (!name?.trim() || name.trim() === getCurrentMapName()) return;
  persistCurrentMap({ mapName: name.trim() });
  updateModeIndicatorForEditor();
}
