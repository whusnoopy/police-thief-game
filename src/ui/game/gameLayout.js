import { els } from "../../app/state.js";

function move(element, destination) {
  if (element && destination && element.parentNode !== destination) destination.appendChild(element);
}

// Move the existing controls so handlers, pending actions and focus survive.
export function renderGameLayout(isometric) {
  const focused = document.activeElement;
  if (isometric) els.gameBoard.parentNode?.classList.remove("large-topdown");
  document.body.classList.toggle("isometric-playing", isometric);
  move(els.appHeader, isometric ? els.isoInfoContent : els.appHeaderHome);
  move(els.gameActions, isometric ? els.isoInfoContent : els.gameSidebar);
  move(els.gameStatusPanel, isometric ? els.isoStatusContent : els.gameSidebar);
  move(els.unitCounts, isometric ? els.isoStatusContent : els.gameSidebar);
  move(els.gameDicePanel, isometric ? els.isoDiceContent : els.gameSidebar);
  move(els.gameActionDetails, isometric ? els.isoProgressContent : els.boardFeedbackHome);
  if (!isometric && els.gameSidebar && els.gameActions) els.gameSidebar.appendChild(els.gameActions);
  [els.isoPanelInfo, els.isoPanelStatus, els.isoPanelProgress, els.isoPanelDice].forEach(element => element?.classList.toggle("hidden", !isometric));
  [els.appHeaderHome, els.boardFeedbackHome].forEach(element => element?.classList.toggle("hidden", isometric));
  if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
}
