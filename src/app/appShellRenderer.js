import { els } from "./state.js";

export function renderAppShell(shellState) {
  els.editorView.classList.toggle("hidden", shellState.editorHidden);
  els.gameView.classList.toggle("hidden", shellState.gameHidden);
  els.mapListView.classList.toggle("hidden", shellState.mapListHidden);
  const editing = !shellState.editorHidden;
  document.body.classList.toggle("editor-playing", editing);
  if (!shellState.gameHidden) {
    // The game renderer owns the header while its view is active.
    if (els.appHeader?.parentNode === els.editorHeaderSlot) els.appHeaderHome?.appendChild(els.appHeader);
  } else {
    const destination = editing ? els.editorHeaderSlot : els.appHeaderHome;
    if (els.appHeader && destination && els.appHeader.parentNode !== destination) destination.appendChild(els.appHeader);
    els.appHeaderHome?.classList.toggle("hidden", editing);
  }

  if (!els.modeIndicator) return;

  els.modeIndicatorLabel.textContent = shellState.modeIndicatorText;
  els.btnRenameCurrentMap.classList.toggle("hidden", !editing);
  els.modeIndicator.style.backgroundColor = shellState.modeIndicatorColor;
  els.modeIndicator.title = shellState.modeIndicatorTitle;
}
