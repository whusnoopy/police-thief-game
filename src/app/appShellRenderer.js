import { els } from "./state.js";

export function renderAppShell(shellState) {
  els.editorView.classList.toggle("hidden", shellState.editorHidden);
  els.gameView.classList.toggle("hidden", shellState.gameHidden);
  els.mapListView.classList.toggle("hidden", shellState.mapListHidden);

  if (!els.modeIndicator) return;

  els.modeIndicator.textContent = shellState.modeIndicatorText;
  els.modeIndicator.style.backgroundColor = shellState.modeIndicatorColor;
  els.modeIndicator.title = shellState.modeIndicatorTitle;
}
