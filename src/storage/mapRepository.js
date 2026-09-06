import { els, setMapDefinition, state } from "../app/state.js";
import { encodeMapDefinition } from "../domain/map/mapCodec.js";
import { getAppShellState } from "../app/appShellState.js";
import { renderAppShell } from "../app/appShellRenderer.js";
import {
  getCurrentMapIdFromStorage,
  getMapListFromStorage,
  migrateLegacyStorage,
  STORAGE_KEYS,
  setCurrentMapIdToStorage,
  setMapListToStorage,
} from "./mapStore.js";
import { upsertMapRecordInList } from "./mapRecords.js";
import { resolveInitialMapLoad } from "./mapLoadPlan.js";
import { createResilientStorage } from "./resilientStorage.js";
import { planMapImport } from "./mapBackup.js";

let currentShareLink = "";
let storageProblem = "";
let dataProblem = "";
let unreadableStorage = {};
let mapStorage;

function renderStorageNotice() {
  if (!els.storageNotice || !els.storageNoticeMessage) return;
  const message = [storageProblem, dataProblem].filter(Boolean).join(" ");
  els.storageNoticeMessage.textContent = message;
  els.storageNotice.classList.toggle("hidden", !message);
}

function getStorage() {
  mapStorage ||= createResilientStorage(() => localStorage, (error) => {
    storageProblem = error
      ? "地图修改尚未保存到浏览器。请导出地图备份；存储恢复后可重试保存。"
      : "";
    renderStorageNotice();
  });
  return mapStorage;
}

function preserveUnreadableStorage(error) {
  if (!error.storageKey) return;
  const storage = getStorage();
  unreadableStorage[error.storageKey] = storage.getItem(error.storageKey);
  storage.protectItem(error.storageKey);
  dataProblem = "部分地图库数据无法读取，原始数据已保留，导出备份会包含原文。";
  renderStorageNotice();
}

function downloadJson(name, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createMapBackup() {
  const encodedMap = encodeMapDefinition(state.mapDefinition);
  const maps = getMapList();
  const name = maps.find((record) => record.id === getCurrentMapId())?.name || "当前地图";
  return {
    version: 1,
    currentMap: { name, encodedMap, mapDefinition: state.mapDefinition, shareUrl: buildMapShareUrl(encodedMap) },
    maps,
    unreadableStorage: { ...unreadableStorage },
  };
}

export function exportMapBackup() {
  downloadJson("police-thief-maps-backup.json", createMapBackup());
}

export function importMapBackup(text) {
  const plan = planMapImport(text, getMapList());
  const saved = plan.imported + plan.corrupt === 0 || setMapList(plan.maps);
  return { ...plan, saved };
}

export function exportMapRecord(record) {
  downloadJson("police-thief-map-backup.json", record);
}

export function initStorageNotice() {
  els.btnExportMapBackup?.addEventListener("click", exportMapBackup);
  els.btnRetryMapSave?.addEventListener("click", retryMapSave);
}

export function retryMapSave() {
  const storage = getStorage();
  const recovered = storage.recoverReads((key, stored, buffered) => {
    if (key !== STORAGE_KEYS.mapList) return buffered;
    const read = (value) => getMapListFromStorage({ getItem: () => value });
    const savedMaps = read(stored);
    const bufferedMaps = read(buffered);
    const ids = new Set(bufferedMaps.map((record) => record.id));
    return JSON.stringify([...bufferedMaps, ...savedMaps.filter((record) => !ids.has(record.id))]);
  });
  if (!recovered) return;
  try { migrateLegacyStorage(storage); } catch (error) { preserveUnreadableStorage(error); }
  persistCurrentMap();
}

export { formatDefaultMapName } from "./mapStore.js";

export function formatDuplicateMapName(sourceName, existingMaps) {
  const baseName = `${sourceName}（副本）`;
  if (!existingMaps.some((mapItem) => mapItem.name === baseName)) return baseName;

  let index = 2;
  while (existingMaps.some((mapItem) => mapItem.name === `${sourceName}（副本${index}）`)) {
    index += 1;
  }
  return `${sourceName}（副本${index}）`;
}

function refreshDataNotice(maps) {
  dataProblem = Object.keys(unreadableStorage).length
    ? "部分地图库数据无法读取，原始数据已保留，导出备份会包含原文。"
    : maps.some((record) => record.isCorrupt)
      ? "部分地图无法读取，已保留原始数据；可在地图库导出原始备份。" : "";
  renderStorageNotice();
}

export function getMapList() {
  try {
    const maps = getMapListFromStorage(getStorage());
    refreshDataNotice(maps);
    return maps;
  } catch (error) {
    preserveUnreadableStorage(error);
    // Continue with a separate in-memory library. The protected original key
    // cannot be overwritten, even by subsequent autosaves or a retry.
    try { getStorage().setItem(STORAGE_KEYS.mapList, "[]"); } catch { /* notice is already visible */ }
    return [];
  }
}

export function setMapList(list) {
  try {
    setMapListToStorage(getStorage(), list);
    refreshDataNotice(list);
    return true;
  } catch {
    refreshDataNotice(list);
    return false;
  }
}

export function getCurrentMapId() {
  return getCurrentMapIdFromStorage(getStorage());
}

export function setCurrentMapId(mapId) {
  try { setCurrentMapIdToStorage(getStorage(), mapId); } catch { /* retain current id in memory */ }
}

export function getCurrentMapName() {
  const currentMapId = getCurrentMapId();
  if (!currentMapId) return "";

  const currentMap = getMapList().find((mapItem) => mapItem.id === currentMapId);
  return currentMap?.name || "";
}

export function updateModeIndicatorForEditor() {
  renderAppShell(
    getAppShellState({
      mode: "EDITOR",
      currentMapName: getCurrentMapName(),
    }),
  );
}

export function buildMapShareUrl(encodedMap) {
  return `${window.location.protocol}//${window.location.host}${window.location.pathname}?m=${encodedMap}`;
}

function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    helper.style.pointerEvents = "none";
    document.body.appendChild(helper);
    helper.focus();
    helper.select();

    const copied = document.execCommand("copy");
    document.body.removeChild(helper);

    if (copied) resolve();
    else reject(new Error("copy failed"));
  });
}

function showShareLinkModal(link, copied = true) {
  if (!els.shareLinkModal || !els.shareLinkInput || !els.shareLinkMessage) return;

  currentShareLink = link;
  els.shareLinkInput.value = link;
  els.shareLinkMessage.textContent = copied
    ? "分享链接已复制到剪贴板，也可以在下方手动复制。"
    : "自动复制失败，请手动复制下方链接。";
  els.shareLinkModal.classList.remove("hidden");

  setTimeout(() => {
    els.shareLinkInput.focus();
    els.shareLinkInput.select();
  }, 0);
}

export function hideShareLinkModal() {
  if (!els.shareLinkModal) return;
  els.shareLinkModal.classList.add("hidden");
}

export function shareMapByData(encodedMap) {
  const shareLink = buildMapShareUrl(encodedMap);
  copyTextToClipboard(shareLink)
    .then(() => showShareLinkModal(shareLink, true))
    .catch(() => showShareLinkModal(shareLink, false));
}

export function initShareLinkModal() {
  if (els.btnCloseShareLinkModal) {
    els.btnCloseShareLinkModal.addEventListener("click", hideShareLinkModal);
  }

  if (els.shareLinkModal) {
    els.shareLinkModal.addEventListener("click", (event) => {
      if (event.target === els.shareLinkModal) hideShareLinkModal();
    });
  }

  if (els.btnCopyShareLink) {
    els.btnCopyShareLink.addEventListener("click", () => {
      if (!currentShareLink) return;

      copyTextToClipboard(currentShareLink)
        .then(() => {
          if (els.shareLinkMessage) {
            els.shareLinkMessage.textContent =
              "链接已再次复制到剪贴板，也可以继续手动复制。";
          }
          if (els.shareLinkInput) {
            els.shareLinkInput.focus();
            els.shareLinkInput.select();
          }
        })
        .catch(() => {
          if (els.shareLinkMessage) {
            els.shareLinkMessage.textContent = "自动复制失败，请手动复制下方链接。";
          }
        });
    });
  }
}

export function upsertCurrentMapInList(
  encodedMap = encodeMapDefinition(state.mapDefinition),
  options = {},
) {
  const { forceNew = false, name = null } = options;
  const result = upsertMapRecordInList({
    maps: getMapList(),
    currentMapId: getCurrentMapId(),
    encodedMap,
    forceNew,
    name,
  });

  setMapList(result.maps);
  setCurrentMapId(result.currentMapId);
  return result.currentMap;
}

export function updateMapUrl(encodedMap = encodeMapDefinition(state.mapDefinition)) {
  const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?m=${encodedMap}`;
  try {
    window.history.replaceState({ path: newUrl }, "", newUrl);
  } catch (error) {
    console.warn("地图地址未能更新，可从地图库分享或导出。", error);
  }
}

export function persistCurrentMap(options = {}) {
  const { forceNewMap = false, mapName = null } = options;
  const encodedMap = encodeMapDefinition(state.mapDefinition);
  upsertCurrentMapInList(encodedMap, { forceNew: forceNewMap, name: mapName });
  updateMapUrl(encodedMap);
  return encodedMap;
}

export function loadInitialMapIntoState() {
  mapStorage = null;
  storageProblem = "";
  dataProblem = "";
  unreadableStorage = {};
  try { migrateLegacyStorage(getStorage()); } catch (error) { preserveUnreadableStorage(error); }
  const maps = getMapList();
  const currentMap = maps.find((record) => record.id === getCurrentMapId()) || maps[0];
  if (currentMap && !currentMap.isCorrupt) setCurrentMapId(currentMap.id);
  const savedEncodedMap = currentMap?.encodedMap || null;
  const urlParams = new URLSearchParams(window.location.search);
  const sharedEncodedMap = urlParams.get("m");
  const loadPlan = resolveInitialMapLoad({
    savedEncodedMap,
    sharedEncodedMap,
  });

  setMapDefinition(loadPlan.mapDefinition);
  persistCurrentMap({ forceNewMap: loadPlan.forceNewMap || Boolean(currentMap?.isCorrupt) });
  renderStorageNotice();
}
