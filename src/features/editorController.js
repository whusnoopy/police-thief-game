import { TILE_TYPES } from "../config/constants.js";
import { els, setMapDefinition, state } from "../app/state.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../domain/map/mapModel.js";
import { getFeaturePositionsByKind, getTileTypeAt } from "../domain/map/mapQueries.js";
import { persistCurrentMap } from "../storage/mapRepository.js";
import { renderBoard, syncBoardCell } from "../ui/board/boardRenderer.js";
import { renderPalette, updatePaletteRequirementStatus } from "../ui/editor/editorRenderer.js";

let isMouseDown = false;
let pointerStateBound = false;

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

export function initEditor() {
  bindPointerState();
  renderPalette(els.palette, {
    tileTypes: Object.values(TILE_TYPES).filter((tileType) => !tileType.hiddenFromPalette),
    currentPaletteType: state.currentPaletteType,
    onSelect(typeId, item) {
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
    bindCell(cell, { r, c }) {
      const paint = () => {
        if (getTileTypeAt(state.mapDefinition, r, c) === state.currentPaletteType) return;
        setLegacyTileAt(state.mapDefinition, r, c, state.currentPaletteType);
        syncBoardCell({
          element: cell,
          mapDefinition: state.mapDefinition,
          r,
          c,
        });
        syncPaletteRequirementStatus();
        persistCurrentMap();
      };

      cell.addEventListener("mousedown", (event) => {
        event.preventDefault();
        paint();
      });
      cell.addEventListener("mouseenter", () => {
        if (isMouseDown) paint();
      });
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
