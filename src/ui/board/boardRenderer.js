import { GRID_SIZE } from "../../config/constants.js";
import { getCellDisplayAt } from "../../domain/map/cellDisplay.js";

function appendMarker(element, emoji) {
  const marker = document.createElement("span");
  marker.className = "marker";
  marker.textContent = emoji;
  element.appendChild(marker);
}

export function getBoardCellId(prefix, r, c) {
  return `${prefix}-${r}-${c}`;
}

export function getBoardCellElement(prefix, r, c) {
  return document.getElementById(getBoardCellId(prefix, r, c));
}

export function applyBoardCellDisplay(element, display) {
  element.className = display.className;
  element.innerHTML = "";

  if (display.showMarker) {
    appendMarker(element, display.markerEmoji);
  }

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
