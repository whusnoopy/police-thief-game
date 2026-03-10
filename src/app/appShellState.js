export function getAppShellState({ mode, currentMapName = "" } = {}) {
  if (mode === "GAME") {
    return {
      editorHidden: true,
      gameHidden: false,
      mapListHidden: true,
      modeIndicatorText: "游戏模式",
      modeIndicatorColor: "var(--success-color)",
      modeIndicatorTitle: "",
    };
  }

  if (mode === "MAP_LIST") {
    return {
      editorHidden: true,
      gameHidden: true,
      mapListHidden: false,
      modeIndicatorText: "地图列表",
      modeIndicatorColor: "var(--info-color)",
      modeIndicatorTitle: "",
    };
  }

  return {
    editorHidden: false,
    gameHidden: true,
    mapListHidden: true,
    modeIndicatorText: currentMapName ? `编辑中：${currentMapName}` : "地图编辑模式",
    modeIndicatorColor: "var(--warning-color)",
    modeIndicatorTitle: currentMapName || "",
  };
}
