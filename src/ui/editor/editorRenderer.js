export function renderPalette(container, { tileTypes, currentPaletteType, onSelect }) {
  container.innerHTML = "";

  tileTypes.forEach((type) => {
    const item = document.createElement("div");
    item.className = `palette-item ${type.id === currentPaletteType ? "active" : ""}`;
    item.dataset.type = type.id;
    item.innerHTML = `<span class="palette-icon">${type.emoji}</span><span class="palette-name">${type.name}</span>`;
    item.addEventListener("click", () => onSelect(type.id, item));
    container.appendChild(item);
  });
}
