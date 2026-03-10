import test from "node:test";
import assert from "node:assert/strict";
import { getAppShellState } from "../src/app/appShellState.js";

test("editor shell state includes current map context", () => {
  const result = getAppShellState({
    mode: "EDITOR",
    currentMapName: "测试地图",
  });

  assert.equal(result.editorHidden, false);
  assert.equal(result.gameHidden, true);
  assert.equal(result.mapListHidden, true);
  assert.equal(result.modeIndicatorText, "编辑中：测试地图");
  assert.equal(result.modeIndicatorColor, "var(--warning-color)");
});

test("game shell state focuses the game view", () => {
  const result = getAppShellState({ mode: "GAME" });

  assert.equal(result.editorHidden, true);
  assert.equal(result.gameHidden, false);
  assert.equal(result.mapListHidden, true);
  assert.equal(result.modeIndicatorText, "游戏模式");
  assert.equal(result.modeIndicatorColor, "var(--success-color)");
});

test("map-list shell state shows the list view", () => {
  const result = getAppShellState({ mode: "MAP_LIST" });

  assert.equal(result.editorHidden, true);
  assert.equal(result.gameHidden, true);
  assert.equal(result.mapListHidden, false);
  assert.equal(result.modeIndicatorText, "地图列表");
  assert.equal(result.modeIndicatorColor, "var(--info-color)");
});
