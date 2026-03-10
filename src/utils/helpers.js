import { els } from "../app/state.js";

export function showToast(message, targetBtn = null) {
  const btn = targetBtn || els.btnMapList;
  if (!btn) return;

  const oldText = btn.innerHTML;
  btn.innerHTML = `✅ ${message}`;
  btn.disabled = true;

  setTimeout(() => {
    btn.innerHTML = oldText;
    btn.disabled = false;
  }, 1500);
}

export function escapeHTML(str) {
  const node = document.createElement("p");
  node.appendChild(document.createTextNode(str));
  return node.innerHTML;
}
