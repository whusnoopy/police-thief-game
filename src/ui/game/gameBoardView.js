import { getMapDimensions } from "../../domain/map/mapDimensions.js";
import { SIGNAL_PHASES, normalizeSignalPhase } from "../../config/constants.js";
import { getCrosswalkSignalPositions, isCrosswalkTileType } from "../../domain/map/crosswalk.js";
import { renderBoard } from "../board/boardRenderer.js";
import { appendParkedCar, renderUnits } from "./unitRenderer.js";
import { clearBoardHighlights, clearPathPreview, highlightReachableCells, highlightSelectableCells, highlightSelectedCell, renderPathPreview } from "./highlightRenderer.js";
import { createIsometricGameView } from "../isometric/isometricRenderer.js";

export function createGameBoardView(container, options) {
  if (options.mode === "isometric") return createIsometricGameView(container, options);
  const prefix = "game-cell";
  return {
    render(session) {
      container.className = "board grid-10x10";
      container.parentNode?.classList.toggle("large-topdown", getMapDimensions(session.mapDefinition).rows > 10);
      renderBoard(container, {
        mapDefinition: session.mapDefinition,
        cellIdPrefix: prefix,
        decorateCell(cell, { r, c, display }) {
          if (isCrosswalkTileType(display.tileType)) {
            const color = normalizeSignalPhase(session.signalPhase) === SIGNAL_PHASES.PEDESTRIAN_GREEN ? "green" : "red";
            for (const position of getCrosswalkSignalPositions(display.tileType)) {
              const light = document.createElement("span");
              light.className = `signal-light ${position} ${color}`;
              cell.appendChild(light);
            }
          }
          if (session.parkedCars.has(`${r},${c}`)) appendParkedCar(cell);
        },
        bindCell(cell, { r, c }) {
          let pointerType = "mouse";
          cell.addEventListener("pointerdown", (event) => { pointerType = event.pointerType; });
          cell.addEventListener("mouseenter", () => options.onCellHover(r, c));
          cell.addEventListener("mouseleave", options.onLeave);
          cell.addEventListener("click", (event) => {
            const inputType = event.pointerType || pointerType;
            pointerType = "mouse";
            options.onCellClick(r, c, { previewOnly: inputType === "touch" || inputType === "pen" });
          });
        },
      });
      renderUnits({ cellIdPrefix: prefix, policeUnits: session.policeUnits, thiefUnits: session.thiefUnits, animalUnits: session.animalUnits });
    },
    clearHighlights() { clearBoardHighlights(container); },
    setSelectable(positions) { highlightSelectableCells(prefix, positions); },
    setReachable(positions) { highlightReachableCells(prefix, positions); },
    setSelected(position) { highlightSelectedCell(prefix, position); },
    setPath(segments) { clearPathPreview(container); renderPathPreview(prefix, segments); },
    clearPath() { clearPathPreview(container); },
    setZoom() {},
    dispose() { container.innerHTML = ""; },
  };
}
