import { els } from "../../app/state.js";

function move(element, destination) {
  if (element && destination && element.parentNode !== destination) destination.appendChild(element);
}

// Move the existing controls so handlers, pending actions and focus survive.
export function renderGameLayout(isometric, panelsCollapsed = false) {
  const focused = document.activeElement;
  if (isometric) els.gameBoard.parentNode?.classList.remove("large-topdown");
  document.body.classList.toggle("isometric-playing", isometric);
  document.body.classList.toggle("isometric-sidebar-collapsed", isometric && panelsCollapsed);
  move(els.appHeader, isometric ? els.isoInfoContent : els.appHeaderHome);
  move(els.boardToolbar, isometric ? els.isoInfoContent : els.boardToolbarHome);
  move(els.isometricHelp, isometric ? els.isoInfoContent : els.boardToolbarHome);
  move(els.gameActions, isometric ? els.isoInfoContent : els.gameSidebar);
  move(els.gameStatusPanel, isometric ? els.isoStatusContent : els.gameSidebar);
  move(els.unitCounts, isometric ? els.isoStatusContent : els.gameSidebar);
  move(els.gameDicePanel, isometric ? els.isoDiceContent : els.gameSidebar);
  move(els.gameActionDetails, isometric ? els.isoProgressContent : els.boardFeedbackHome);
  move(els.boardZoomControls, isometric ? panelsCollapsed ? els.gameMapZoomSlot : els.isoStatusZoom : els.boardToolbar);
  if (!isometric && els.gameSidebar && els.gameActions) els.gameSidebar.appendChild(els.gameActions);
  [els.isoPanelInfo, els.isoPanelStatus, els.isoPanelProgress, els.isoPanelDice, els.gameMapControls].forEach(element => element?.classList.toggle("hidden", !isometric));
  [els.appHeaderHome, els.boardToolbarHome, els.boardFeedbackHome].forEach(element => element?.classList.toggle("hidden", isometric));
  if (els.btnToggleGameSidebar) {
    els.btnToggleGameSidebar.textContent = panelsCollapsed ? "展开面板" : "收起面板";
    els.btnToggleGameSidebar.setAttribute("aria-expanded", String(!panelsCollapsed));
  }
  if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
}

export function revealActionPanel() {
  if (els.isoPanelProgress) els.isoPanelProgress.open = true;
}
