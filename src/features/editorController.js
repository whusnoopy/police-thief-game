import { TILE_TYPES } from "../config/constants.js";
import { els, setMapDefinition, state } from "../app/state.js";
import { createEmptyMapDefinition, setLegacyTileAt } from "../domain/map/mapModel.js";
import { getFeaturePositionsByKind, getTileTypeAt } from "../domain/map/mapQueries.js";
import { persistCurrentMap } from "../storage/mapRepository.js";
import { renderBoard, syncBoardCell } from "../ui/board/boardRenderer.js";
import { renderPalette } from "../ui/editor/editorRenderer.js";

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

export function initEditor() {
  bindPointerState();
  renderPalette(els.palette, {
    tileTypes: Object.values(TILE_TYPES).filter((tileType) => !tileType.hiddenFromPalette),
    currentPaletteType: state.currentPaletteType,
    onSelect(typeId, item) {
      document.querySelectorAll(".palette-item").forEach((paletteItem) => {
        paletteItem.classList.remove("active");
      });
      item.classList.add("active");
      state.currentPaletteType = typeId;
    },
  });

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
}

export function clearMap() {
  if (!confirm("确定要清空地图吗？所有地块将被重置为草地。")) return;

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
