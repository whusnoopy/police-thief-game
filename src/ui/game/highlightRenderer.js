import { getBoardCellElement } from "../board/boardRenderer.js";

function addClassToCell(cellIdPrefix, position, className) {
  const cell = getBoardCellElement(cellIdPrefix, position.r, position.c);
  if (cell) cell.classList.add(className);
}

export function clearPathPreview(boardElement) {
  boardElement.querySelectorAll(".path-hover").forEach((element) => {
    element.classList.remove("path-hover");
  });
  boardElement.querySelectorAll(".path-badge-temp").forEach((element) => {
    element.remove();
  });
}

export function clearBoardHighlights(boardElement) {
  boardElement.querySelectorAll(".reachable").forEach((element) => {
    element.classList.remove("reachable");
  });
  boardElement.querySelectorAll(".selectable-unit").forEach((element) => {
    element.classList.remove("selectable-unit");
  });
  boardElement.querySelectorAll(".unit-selected").forEach((element) => {
    element.classList.remove("unit-selected");
  });
  clearPathPreview(boardElement);
}

export function highlightSelectableCells(cellIdPrefix, positions) {
  positions.forEach((position) => {
    addClassToCell(cellIdPrefix, position, "selectable-unit");
  });
}

export function highlightReachableCells(cellIdPrefix, positions) {
  positions.forEach((position) => {
    addClassToCell(cellIdPrefix, position, "reachable");
  });
}

export function highlightSelectedCell(cellIdPrefix, position) {
  addClassToCell(cellIdPrefix, position, "unit-selected");
}

export function renderPathPreview(cellIdPrefix, segments) {
  segments.forEach((segment) => {
    const cell = getBoardCellElement(cellIdPrefix, segment.r, segment.c);
    if (!cell) return;

    cell.classList.add("path-hover");

    const badge = document.createElement("div");
    badge.className = "step-badge path-badge-temp";
    badge.textContent = segment.label;
    cell.appendChild(badge);
  });
}
