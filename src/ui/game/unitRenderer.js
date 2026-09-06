import { getBoardCellElement } from "../board/boardRenderer.js";

function getPoliceEmoji(unit) {
  if (unit.inCar) return unit.state === "CARRYING" ? "🚔" : "🚓";
  return unit.state === "CARRYING" ? "👮🎒" : "👮";
}

function getThiefEmoji(unit) {
  if (unit.hasMoney) return unit.inCar ? "🚗💰" : "🏃💰";
  return unit.inCar ? "🚗" : "🏃";
}

function getAnimalEmoji(unit) {
  return unit.emoji || "🐷";
}

function appendUnitToken(cell, { emoji, cssClass, id, isDriving }) {
  const token = document.createElement("div");
  token.className = `character ${cssClass}${isDriving ? " driving-token" : ""}${Array.from(emoji).length > 1 ? " multi-symbol-token" : ""}`;
  token.textContent = emoji;
  token.dataset.id = id;
  if (cssClass !== "animal-token") {
    token.title = `${cssClass === "police-token" ? "警察" : "小偷"} ${id.slice(1)}`;
    token.setAttribute("role", "img");
    token.setAttribute("aria-label", `${token.title} ${emoji}`);
    const badge = document.createElement("span");
    badge.className = "unit-id-badge";
    badge.textContent = id;
    badge.setAttribute("aria-hidden", "true");
    token.appendChild(badge);
  }
  cell.appendChild(token);
}

export function appendParkedCar(cell) {
  const parkedCar = document.createElement("span");
  parkedCar.className = "parked-car";
  parkedCar.textContent = "🚗";
  cell.appendChild(parkedCar);
}

function renderAnimalUnits({ cellIdPrefix, animalUnits }) {
  animalUnits.forEach((animal) => {
    const cell = getBoardCellElement(cellIdPrefix, animal.r, animal.c);
    if (!cell) return;

    appendUnitToken(cell, {
      emoji: getAnimalEmoji(animal),
      cssClass: "animal-token",
      id: animal.id,
      isDriving: false,
    });
  });
}

export function renderUnits({ cellIdPrefix, policeUnits, thiefUnits, animalUnits = [] }) {
  renderAnimalUnits({ cellIdPrefix, animalUnits });

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
