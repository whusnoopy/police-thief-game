import { els, setMapDefinition, state } from "../app/state.js";
import { encodeMapDefinition } from "../domain/map/mapCodec.js";
import { getAppShellState } from "../app/appShellState.js";
import { renderAppShell } from "../app/appShellRenderer.js";
import {
  getCurrentMapIdFromStorage,
  getStoredEncodedMapFromStorage,
  migrateLegacyStorage,
  normalizeMapRecord,
  STORAGE_KEYS,
  setCurrentMapIdToStorage,
  setMapListToStorage,
} from "./mapStore.js";
import { upsertMapRecordInList } from "./mapRecords.js";
import { resolveInitialMapLoad } from "./mapLoadPlan.js";

let currentShareLink = "";

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

export function getMapList() {
  let rawList = [];

  try {
    const storedList = localStorage.getItem(STORAGE_KEYS.mapList);
    const parsed = storedList ? JSON.parse(storedList) : [];
    rawList = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    rawList = [];
  }

  const normalized = rawList.map((record) => normalizeMapRecord(record));
  const needsRewrite = normalized.some((record, index) => {
    const raw = rawList[index] || {};
    return (
      raw.encodedMap !== record.encodedMap ||
      raw.updatedAt !== record.updatedAt ||
      raw.schemaVersion !== 3
    );
  });
  if (needsRewrite) setMapList(normalized);
  return normalized;
}

export function setMapList(list) {
  setMapListToStorage(localStorage, list);
}

export function getCurrentMapId() {
  return getCurrentMapIdFromStorage(localStorage);
}

export function setCurrentMapId(mapId) {
  setCurrentMapIdToStorage(localStorage, mapId);
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
  window.history.replaceState({ path: newUrl }, "", newUrl);
}

export function persistCurrentMap(options = {}) {
  const { forceNewMap = false, mapName = null } = options;
  const encodedMap = encodeMapDefinition(state.mapDefinition);
  upsertCurrentMapInList(encodedMap, { forceNew: forceNewMap, name: mapName });
  updateMapUrl(encodedMap);
  return encodedMap;
}

export function loadInitialMapIntoState() {
  migrateLegacyStorage(localStorage);
  const savedEncodedMap = getStoredEncodedMapFromStorage(localStorage);
  const urlParams = new URLSearchParams(window.location.search);
  const sharedEncodedMap = urlParams.get("m");
  const loadPlan = resolveInitialMapLoad({
    savedEncodedMap,
    sharedEncodedMap,
  });

  setMapDefinition(loadPlan.mapDefinition);
  persistCurrentMap({ forceNewMap: loadPlan.forceNewMap });
}
