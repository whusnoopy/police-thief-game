import { els } from "../../app/state.js";

function move(element, destination) {
  if (element && destination && element.parentNode !== destination) destination.appendChild(element);
}

// Mount the shared header inside the isometric info panel while gameplay is active.
export function renderGameLayout(active) {
  const focused = document.activeElement;
  document.body.classList.toggle("isometric-playing", active);
  move(els.appHeader, active ? els.isoHeaderSlot : els.appHeaderHome);
  els.appHeaderHome?.classList.toggle("hidden", active);
  if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
}
