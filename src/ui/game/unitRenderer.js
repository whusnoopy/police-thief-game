import { getBoardCellElement } from "../board/boardRenderer.js";

function getPoliceEmoji(unit) {
  if (unit.inCar) return unit.state === "CARRYING" ? "🚔" : "🚓";
  return unit.state === "CARRYING" ? "👮🎒" : "👮";
}

function getThiefEmoji(unit) {
  return unit.inCar ? "🚗" : "🏃";
}

function appendUnitToken(cell, { emoji, cssClass, id, isDriving }) {
  const token = document.createElement("div");
  token.className = `character ${cssClass}${isDriving ? " driving-token" : ""}`;
  token.textContent = emoji;
  token.dataset.id = id;
  cell.appendChild(token);
}

export function appendParkedCar(cell) {
  const parkedCar = document.createElement("span");
  parkedCar.className = "parked-car";
  parkedCar.textContent = "🚗";
  cell.appendChild(parkedCar);
}

export function renderUnits({ cellIdPrefix, policeUnits, thiefUnits }) {
  policeUnits.forEach((police) => {
    const cell = getBoardCellElement(cellIdPrefix, police.r, police.c);
    if (!cell) return;

    appendUnitToken(cell, {
      emoji: getPoliceEmoji(police),
      cssClass: "police-token",
      id: police.id,
      isDriving: police.inCar,
    });
  });

  thiefUnits.forEach((thief) => {
    if (thief.state !== "ACTIVE") return;

    const cell = getBoardCellElement(cellIdPrefix, thief.r, thief.c);
    if (!cell) return;

    appendUnitToken(cell, {
      emoji: getThiefEmoji(thief),
      cssClass: "thief-token",
      id: thief.id,
      isDriving: thief.inCar,
    });
  });
}
