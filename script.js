// Initialization
function startGame() {
  if (!validateMap()) return;
  state.mode = "GAME";
  els.editorView.classList.add("hidden");
  els.gameView.classList.remove("hidden");
  document.getElementById("mode-indicator").textContent = "游戏模式";
  document.getElementById("mode-indicator").style.backgroundColor =
    "var(--success-color)";
  saveMap();
  gameEngine.init();
}

function backToEditor() {
  if (!confirm("返回编辑器将结束当前游戏进度，确定吗？")) return;
  state.mode = "EDITOR";
  els.gameView.classList.add("hidden");
  els.editorView.classList.remove("hidden");
  document.getElementById("mode-indicator").textContent = "地图编辑模式";
  document.getElementById("mode-indicator").style.backgroundColor =
    "var(--warning-color)";
  renderEditorBoard();
}

function init() {
  initEditor();
  loadMap();
  renderEditorBoard();

  // Bind global navigation
  els.btnStartGame.addEventListener("click", startGame);
  els.btnBackEditor.addEventListener("click", backToEditor);
  els.btnPlayAgain.addEventListener("click", () => {
    els.victoryModal.classList.add("hidden");
    gameEngine.init();
  });
  els.btnModalEditor.addEventListener("click", () => {
    els.victoryModal.classList.add("hidden");
    backToEditor();
  });

  // Map List
  if (els.btnMapList) els.btnMapList.addEventListener("click", showMapList);
  if (els.btnBackFromList)
    els.btnBackFromList.addEventListener("click", hideMapList);
  if (els.btnSaveNewMap)
    els.btnSaveNewMap.addEventListener("click", saveMapAsNew);
}

document.addEventListener("DOMContentLoaded", init);
