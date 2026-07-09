import { TILE_TYPES } from "../config/constants.js";
import { els, setMapDefinition, state } from "../app/state.js";
import {
  createEmptyMapDefinition,
  getTilePlacementPlan,
  setLegacyTileAt,
} from "../domain/map/mapModel.js";
import { getFeaturePositionsByKind, getTileTypeAt } from "../domain/map/mapQueries.js";
import {
  getMarkerEmojiForTileType,
  shouldShowMarkerForTileType,
} from "../domain/map/cellDisplay.js";
import { persistCurrentMap } from "../storage/mapRepository.js";
import {
  getBoardCellElement,
  renderBoard,
  syncBoardCell,
} from "../ui/board/boardRenderer.js";
import { renderPalette, updatePaletteRequirementStatus } from "../ui/editor/editorRenderer.js";

const EDITOR_CELL_ID_PREFIX = "editor-cell";
const PLACEMENT_PREVIEW_CLASSES = [
  "placement-preview",
  "placement-valid",
  "placement-invalid",
  "placement-center",
];

let isMouseDown = false;
let pointerStateBound = false;
let placementPreviewStateBound = false;

function bindPointerState() {
  if (pointerStateBound) return;

  document.addEventListener("mousedown", () => {
    isMouseDown = true;
  });
  document.addEventListener("mouseup", () => {
    isMouseDown = false;
  });
  document.addEventListener("mouseleave", () => {
    isMouseDown = false;
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

  els.editorBoard.addEventListener("mouseleave", clearPlacementPreview);
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

  if (shouldShowMarkerForTileType(tileType)) {
    const marker = document.createElement("span");
    marker.className = "placement-ghost-marker";
    marker.textContent = getMarkerEmojiForTileType(tileType);
    ghost.appendChild(marker);
  }

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
}

function syncPlacementCells(plan, fallbackPosition) {
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
  persistCurrentMap();
  renderPlacementPreview(getCurrentPlacementPlan(r, c), { r, c });
  return true;
}

export function initEditor() {
  bindPointerState();
  bindPlacementPreviewState();
  renderPalette(els.palette, {
    tileTypes: Object.values(TILE_TYPES).filter((tileType) => !tileType.hiddenFromPalette),
    currentPaletteType: state.currentPaletteType,
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
  syncPaletteRequirementStatus();

  els.btnClearMap.addEventListener("click", clearMap);
}

export function renderEditorBoard() {
  renderBoard(els.editorBoard, {
    mapDefinition: state.mapDefinition,
    cellIdPrefix: EDITOR_CELL_ID_PREFIX,
    bindCell(cell, { r, c }) {
      cell.addEventListener("mousedown", (event) => {
        event.preventDefault();
        paintPlacement(r, c);
      });
      cell.addEventListener("mouseenter", () => {
        if (isMouseDown) {
          paintPlacement(r, c);
          return;
        }

        previewPlacement(r, c);
      });
      cell.addEventListener("mouseleave", clearPlacementPreview);
    },
  });
  syncPaletteRequirementStatus();
}

export function clearMap() {
  if (!confirm("确定要清空地图吗？所有地块将被重置为普通道路。")) return;

  setMapDefinition(createEmptyMapDefinition());
  renderEditorBoard();
  persistCurrentMap();
}

export function validateMap() {
  const hasPolice = state.mapDefinition.spawns.police.length > 0;
  const hasThief = state.mapDefinition.spawns.thief.length > 0;
  const hasThiefBase = getFeaturePositionsByKind(state.mapDefinition, "THIEF_BASE").length > 0;
  const hasBank = getFeaturePositionsByKind(state.mapDefinition, "BANK").length > 0;

  if (!hasPolice || !hasThief) {
    alert("必须至少放置一个警察出生点和一个小偷出生点！");
    return false;
  }

  if (!hasThiefBase || !hasBank) {
    alert("必须至少放置一个小偷基地和一个银行！");
    return false;
  }

  return true;
}
