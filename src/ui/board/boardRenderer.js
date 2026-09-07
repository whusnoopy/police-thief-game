import { GRID_SIZE, TILE_TYPES } from "../../config/constants.js";
import { getCellDisplayAt } from "../../domain/map/cellDisplay.js";
import { appendTileArt } from './storybookArt.js';
import { terrainArt } from './terrainArt.js';

export function syncBoardTerrain(container, mapDefinition) {
  // One shared SVG under all 100 hit targets. Replacing it also updates diagonal
  // corners after a brush stroke or a mountain's multi-cell placement.
  container.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(terrainArt(mapDefinition).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}")`;
}

export function getBoardCellId(prefix, r, c) {
  return `${prefix}-${r}-${c}`;
}

export function getBoardCellElement(prefix, r, c) {
  return document.getElementById(getBoardCellId(prefix, r, c));
}

export function applyBoardCellDisplay(element, display) {
  element.className = `${display.className} story-cell`;
  element.innerHTML = "";

  appendTileArt(element, display.tileType);

  return element;
}

export function syncBoardCell({
  element,
  mapDefinition,
  r,
  c,
  cellIdPrefix = "",
  decorateCell = null,
}) {
  const display = getCellDisplayAt(mapDefinition, r, c);
  applyBoardCellDisplay(element, display);
  element.setAttribute('aria-label', `第 ${r + 1} 行 ${c + 1} 列，${TILE_TYPES[display.tileType].name}`);

  if (cellIdPrefix) {
    element.id = getBoardCellId(cellIdPrefix, r, c);
  } else {
    element.removeAttribute("id");
  }

  if (decorateCell) {
    decorateCell(element, { r, c, display });
  }

  return display;
}

export function renderBoard(
  container,
  { mapDefinition, cellIdPrefix = "", decorateCell = null, bindCell = null } = {},
) {
  container.innerHTML = "";
  syncBoardTerrain(container, mapDefinition);

  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      const cell = document.createElement("div");
      const display = syncBoardCell({
        element: cell,
        mapDefinition,
        r,
        c,
        cellIdPrefix,
        decorateCell,
      });

      if (bindCell) {
        bindCell(cell, { r, c, display });
      }

      container.appendChild(cell);
    }
  }
}
