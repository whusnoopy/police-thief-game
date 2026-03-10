import { els, setMapDefinition, state } from "../app/state.js";
import { getAppShellState } from "../app/appShellState.js";
import { renderAppShell } from "../app/appShellRenderer.js";
import { decodeMapDefinition } from "../domain/map/mapCodec.js";
import { cloneMapDefinition, createEmptyMapDefinition } from "../domain/map/mapModel.js";
import { renderEditorBoard } from "./editorController.js";
import { renderMapListGrid, setMapListEmptyState } from "../ui/map-list/mapListRenderer.js";
import {
  formatDefaultMapName,
  formatDuplicateMapName,
  getCurrentMapId,
  getMapList,
  initShareLinkModal,
  persistCurrentMap,
  setCurrentMapId,
  setMapList,
  shareMapByData,
  updateModeIndicatorForEditor,
} from "../storage/mapRepository.js";

export function initMapList() {
  initShareLinkModal();
}

export function showMapList() {
  state.mode = "MAP_LIST";
  renderAppShell(getAppShellState({ mode: "MAP_LIST" }));
  renderMapList();
}

export function hideMapList() {
  state.mode = "EDITOR";
  updateModeIndicatorForEditor();
}

export function renderMapList() {
  const maps = getMapList();
  const currentMapId = getCurrentMapId();
  const isEmpty = maps.length === 0;
  setMapListEmptyState(els.mapListEmpty, isEmpty);

  if (isEmpty) {
    els.mapListGrid.innerHTML = "";
    return;
  }

  renderMapListGrid(els.mapListGrid, {
    maps,
    currentMapId,
    resolveMapDefinition(mapObj) {
      try {
        return decodeMapDefinition(mapObj.encodedMap);
      } catch (error) {
        return createEmptyMapDefinition();
      }
    },
    onLoad(mapObj) {
      try {
        setMapDefinition(decodeMapDefinition(mapObj.encodedMap));
      } catch (error) {
        alert("该地图数据损坏，无法加载。");
        return;
      }

      setCurrentMapId(mapObj.id);
      persistCurrentMap();
      renderEditorBoard();
      hideMapList();
    },
    onRename(mapObj) {
      const isCurrentMap = mapObj.id === currentMapId;
      const newName = prompt("请输入新名称:", mapObj.name);
      if (!newName || newName.trim() === "") return;

      mapObj.name = newName.trim();
      setMapList(maps);
      if (isCurrentMap) updateModeIndicatorForEditor();
      renderMapList();
    },
    onDelete(mapObj) {
      const isCurrentMap = mapObj.id === currentMapId;
      if (isCurrentMap) {
        alert("当前编辑地图不能删除，请先新建或加载其他地图。");
        return;
      }

      if (!confirm(`确定要删除地图"${mapObj.name}"吗？`)) return;

      const newList = maps.filter((mapItem) => mapItem.id !== mapObj.id);
      setMapList(newList);
      renderMapList();
    },
    onShare(mapObj) {
      shareMapByData(mapObj.encodedMap);
    },
    onDuplicate(mapObj) {
      let duplicatedMapDefinition;
      try {
        duplicatedMapDefinition = decodeMapDefinition(mapObj.encodedMap);
      } catch (error) {
        alert("该地图数据损坏，无法复制。");
        return;
      }

      const duplicateName = formatDuplicateMapName(mapObj.name, maps);
      setMapDefinition(cloneMapDefinition(duplicatedMapDefinition));
      persistCurrentMap({ forceNewMap: true, mapName: duplicateName });
      renderEditorBoard();
      hideMapList();
    },
  });
}

export function createNewMap() {
  const defaultName = `新${formatDefaultMapName()}`;
  const name = prompt("请输入新地图名称:", defaultName);
  if (!name || name.trim() === "") return;

  setMapDefinition(createEmptyMapDefinition());
  persistCurrentMap({ forceNewMap: true, mapName: name.trim() });
  renderEditorBoard();
  hideMapList();
}
