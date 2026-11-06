import { els } from "../../app/state.js";

function move(element, destination) {
  if (element && destination && element.parentNode !== destination) destination.appendChild(element);
}

// Move existing controls to retain handlers and live text, then restore focus.
export function renderGameLayout(isometric, sidebarCollapsed = false) {
  const focused = document.activeElement;
  document.body.classList.toggle("isometric-playing", isometric);
  document.body.classList.toggle("isometric-sidebar-collapsed", isometric && sidebarCollapsed);
  move(els.appHeader, isometric ? els.gameSidebarHeader : els.appHeaderHome);
  move(els.boardToolbar, isometric ? els.gameSidebarView : els.boardToolbarHome);
  move(els.isometricHelp, isometric ? els.gameSidebarView : els.boardToolbarHome);
  move(els.gameActionDetails, isometric ? els.gameSidebarFeedback : els.boardFeedbackHome);
  move(els.boardZoomControls, isometric ? els.gameMapZoomSlot : els.boardToolbar);
  [els.gameSidebarHeader, els.gameSidebarView, els.gameSidebarFeedback, els.gameMapControls].forEach(element => element?.classList.toggle("hidden", !isometric));
  [els.appHeaderHome, els.boardToolbarHome, els.boardFeedbackHome].forEach(element => element?.classList.toggle("hidden", isometric));
  if (els.btnToggleGameSidebar) {
    els.btnToggleGameSidebar.textContent = sidebarCollapsed ? "展开侧栏" : "收起侧栏";
    els.btnToggleGameSidebar.setAttribute("aria-expanded", String(!sidebarCollapsed));
  }
  if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
}
