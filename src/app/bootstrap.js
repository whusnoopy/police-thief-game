import { els, state } from "./state.js";
import { getAppShellState } from "./appShellState.js";
import { renderAppShell } from "./appShellRenderer.js";
import { initEditor, renderEditorBoard, validateMap } from "../features/editorController.js";
import {
  createNewMap,
  hideMapList,
  initMapList,
  showMapList,
} from "../features/mapListController.js";
import { gameController } from "../features/gameController.js";
import {
  loadInitialMapIntoState,
  persistCurrentMap,
  updateModeIndicatorForEditor,
} from "../storage/mapRepository.js";

function startGame() {
  if (!validateMap()) return;

  state.mode = "GAME";
  renderAppShell(getAppShellState({ mode: "GAME" }));

  persistCurrentMap();
  gameController.init();
}

function backToEditor(options = {}) {
  const skipConfirm = options.skipConfirm === true;
  if (!skipConfirm && !confirm("返回编辑器将结束当前游戏进度，确定吗？")) return;

  state.mode = "EDITOR";
  updateModeIndicatorForEditor();
  renderEditorBoard();
}

export function init() {
  initEditor();
  initMapList();
  loadInitialMapIntoState();
  renderEditorBoard();
  updateModeIndicatorForEditor();

  els.btnStartGame.addEventListener("click", startGame);
  els.btnBackEditor.addEventListener("click", backToEditor);
  els.btnPlayAgain.addEventListener("click", () => {
    els.victoryModal.classList.add("hidden");
    gameController.init();
  });
  els.btnModalEditor.addEventListener("click", () => {
    els.victoryModal.classList.add("hidden");
    backToEditor({ skipConfirm: true });
  });

  els.btnMapList?.addEventListener("click", showMapList);
  els.btnBackFromList?.addEventListener("click", hideMapList);
  els.btnCreateMap?.addEventListener("click", createNewMap);
}
