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

  els.rulesModal.classList.add("hidden");
  state.mode = "GAME";
  renderAppShell(getAppShellState({ mode: "GAME" }));

  persistCurrentMap();
  gameController.init();
}

function backToEditor(options = {}) {
  const skipConfirm = options.skipConfirm === true;
  if (!skipConfirm && !confirm("返回编辑器将结束当前游戏进度，确定吗？")) return;

  gameController.dispose();
  els.rulesModal.classList.add("hidden");
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
  els.rulesModal.classList.add("hidden");
  els.editorHelpTooltip.classList.add("hidden");

  const closeRulesModal = () => els.rulesModal.classList.add("hidden");
  let isEditorHelpPinned = false;
  const setEditorHelpVisible = (isVisible) => {
    els.editorHelpTooltip.classList.toggle("hidden", !isVisible);
    els.btnEditorHelp.setAttribute("aria-expanded", String(isVisible));
  };
  const closeEditorHelp = () => {
    isEditorHelpPinned = false;
    setEditorHelpVisible(false);
  };

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
  els.btnViewRules.addEventListener("click", () => {
    els.rulesModal.classList.remove("hidden");
    els.btnCloseRulesModal.focus();
  });
  els.btnCloseRulesModal.addEventListener("click", closeRulesModal);
  els.btnCloseRulesModalFooter.addEventListener("click", closeRulesModal);
  els.rulesModal.addEventListener("click", (event) => {
    if (event.target === els.rulesModal) closeRulesModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeRulesModal();
  });

  els.editorHelpWrapper.addEventListener("mouseenter", () => setEditorHelpVisible(true));
  els.editorHelpWrapper.addEventListener("mouseleave", () => {
    if (!isEditorHelpPinned) setEditorHelpVisible(false);
  });
  els.btnEditorHelp.addEventListener("focus", () => setEditorHelpVisible(true));
  els.btnEditorHelp.addEventListener("click", (event) => {
    event.stopPropagation();
    isEditorHelpPinned = !isEditorHelpPinned;
    setEditorHelpVisible(isEditorHelpPinned);
  });
  document.addEventListener("click", (event) => {
    if (!els.editorHelpWrapper.contains(event.target)) closeEditorHelp();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeEditorHelp();
  });

  els.btnMapList?.addEventListener("click", showMapList);
  els.btnBackFromList?.addEventListener("click", hideMapList);
  els.btnCreateMap?.addEventListener("click", createNewMap);
}
