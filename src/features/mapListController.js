import { els, setMapDefinition, state } from "../app/state.js";
import { getAppShellState } from "../app/appShellState.js";
import { renderAppShell } from "../app/appShellRenderer.js";
import { decodeMapDefinition } from "../domain/map/mapCodec.js";
import { cloneMapDefinition, createEmptyMapDefinition } from "../domain/map/mapModel.js";
import { renderEditorBoard } from "./editorController.js";
import { renderMapListGrid, setMapListEmptyState } from "../ui/map-list/mapListRenderer.js";
import { MAX_BACKUP_BYTES } from "../storage/mapBackup.js";
import {
  formatDefaultMapName,
  exportMapRecord,
  exportMapBackup,
  importMapBackup,
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
  els.btnExportLibrary.addEventListener("click", exportMapBackup);
  els.btnImportLibrary.addEventListener("click", () => els.mapBackupInput.click());
  els.mapBackupInput.addEventListener("change", () => importMapFile(els.mapBackupInput.files?.[0]));
}

export async function importMapFile(file) {
  if (!file || els.btnImportLibrary.disabled) return;
  els.btnImportLibrary.disabled = true;
  els.mapImportStatus.textContent = "正在读取备份…";
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error("备份文件超过 5 MB，请拆分后导入。");
    const text = await file.text();
    const result = importMapBackup(text);
    els.mapImportStatus.textContent = `已导入 ${result.imported} 张地图，保留 ${result.corrupt} 条损坏原文，跳过 ${result.duplicates} 张重复地图。${result.saved ? "当前编辑地图保持不变，可从下方选择加载。" : "尚未保存到浏览器，请保留备份文件并重试保存。"}`;
    if (state.mode === "MAP_LIST") renderMapList();
  } catch (error) {
    els.mapImportStatus.textContent = error.message || "读取备份失败，未导入任何地图。";
  } finally {
    els.mapBackupInput.value = "";
    els.btnImportLibrary.disabled = false;
  }
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
    onExport: exportMapRecord,
    resolveMapDefinition(mapObj) {
      try {
        return decodeMapDefinition(mapObj.encodedMap);
      } catch (error) {
        return createEmptyMapDefinition();
      }
    },
    onLoad(mapObj) {
      try {
        if (mapObj.id !== getCurrentMapId()) {
          setMapDefinition(decodeMapDefinition(mapObj.encodedMap));
        }
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
      const newName = prompt("请输入新名称:", mapObj.name);
      if (!newName || newName.trim() === "") return;

      mapObj.name = newName.trim();
      setMapList(maps);
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
