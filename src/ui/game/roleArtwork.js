import { appendSprite } from "../board/storybookArt.js";

export function renderRoleIcon(container, side) {
  if (!container || container.dataset.role === side) return;
  container.innerHTML = "";
  container.dataset.role = side;
  appendSprite(container, side, "role-portrait", side === "police" ? "警察" : "小偷");
}

export function renderRoleLabel(container, side, text) {
  container.textContent = "";
  const icon = document.createElement("span");
  icon.className = "role-icon"; icon.setAttribute("aria-hidden", "true");
  renderRoleIcon(icon, side);
  const label = document.createElement("span"); label.textContent = text;
  container.append(icon, label);
}
