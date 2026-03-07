const MAP_LIST_STORAGE_KEY = "policeThiefMapList";
const CURRENT_MAP_ID_STORAGE_KEY = "policeThiefCurrentMapId";

function generateMapId() {
  return "map_" + Date.now() + "_" + Math.random().toString(36).slice(2, 11);
}

function getMapList() {
  const listStr = localStorage.getItem(MAP_LIST_STORAGE_KEY);
  if (!listStr) return [];
  try {
    const parsed = JSON.parse(listStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function setMapList(list) {
  localStorage.setItem(MAP_LIST_STORAGE_KEY, JSON.stringify(list));
}

function getCurrentMapId() {
  return localStorage.getItem(CURRENT_MAP_ID_STORAGE_KEY);
}

function setCurrentMapId(mapId) {
  if (!mapId) {
    localStorage.removeItem(CURRENT_MAP_ID_STORAGE_KEY);
    return;
  }
  localStorage.setItem(CURRENT_MAP_ID_STORAGE_KEY, mapId);
}

function formatDefaultMapName(date = new Date()) {
  const pad = (num) => String(num).padStart(2, "0");
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `地图 ${month}/${day} ${hours}:${minutes}`;
}

function createEmptyMapMatrix() {
  return Array(GRID_SIZE)
    .fill()
    .map(() => Array(GRID_SIZE).fill("GRASS"));
}

function upsertCurrentMapInList(encodedMap = encodeMapToUrlSafeBase64(state.map), options = {}) {
  const { forceNew = false, name = null } = options;
  const maps = getMapList();
  let currentMapId = getCurrentMapId();
  let currentMap =
    !forceNew && currentMapId
      ? maps.find((mapObj) => mapObj.id === currentMapId)
      : null;

  if (!currentMap) {
    const now = Date.now();
    currentMap = {
      id: generateMapId(),
      name: name && name.trim() ? name.trim() : formatDefaultMapName(new Date(now)),
      data: encodedMap,
      date: now,
    };
    currentMapId = currentMap.id;
  } else {
    currentMap.data = encodedMap;
    currentMap.date = Date.now();
    if (name && name.trim()) currentMap.name = name.trim();
  }

  const orderedMaps = [
    currentMap,
    ...maps.filter((mapObj) => mapObj.id !== currentMapId),
  ];
  setMapList(orderedMaps);
  setCurrentMapId(currentMapId);
  return currentMap;
}

function showMapList() {
  els.editorView.classList.add("hidden");
  els.gameView.classList.add("hidden");
  els.mapListView.classList.remove("hidden");
  renderMapList();
}

function hideMapList() {
  els.mapListView.classList.add("hidden");
  els.editorView.classList.remove("hidden");
}

function renderBoardDOM(container, mapMatrix) {
  container.innerHTML = "";
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement("div");
      const tileType = mapMatrix[r][c];
      cell.className = `cell type-${tileType}`;

      if (
        TILE_TYPES[tileType].isSpawn ||
        (tileType !== "GRASS" && tileType !== "ROAD")
      ) {
        const marker = document.createElement("span");
        marker.className = "marker";
        marker.textContent = TILE_TYPES[tileType].emoji;
        cell.appendChild(marker);
      }
      container.appendChild(cell);
    }
  }
}

function renderMapList() {
  const maps = getMapList();
  const currentMapId = getCurrentMapId();
  els.mapListGrid.innerHTML = "";

  if (maps.length === 0) {
    els.mapListEmpty.classList.remove("hidden");
    return;
  }

  els.mapListEmpty.classList.add("hidden");

  maps.forEach((mapObj) => {
    const card = document.createElement("div");
    card.className = "map-card";

    const isCurrentMap = mapObj.id === currentMapId;
    if (isCurrentMap) card.classList.add("current-map");

    const header = document.createElement("div");
    header.className = "map-card-header";
    const dateText = new Date(mapObj.date).toLocaleString();
    header.innerHTML = `
      <span class="map-card-title">
        ${escapeHTML(mapObj.name)}
        ${isCurrentMap ? '<span class="map-card-current-tag">当前编辑</span>' : ""}
      </span>
      <span class="map-card-date">${dateText}</span>
    `;

    const thumb = document.createElement("div");
    thumb.className = "map-card-thumb";
    const boardElement = document.createElement("div");
    boardElement.className = "board grid-10x10 mini-board";
    let mapMatrix = createEmptyMapMatrix();
    try {
      mapMatrix = decodeUrlSafeBase64ToMap(mapObj.data);
    } catch (e) {
      mapMatrix = createEmptyMapMatrix();
    }
    renderBoardDOM(boardElement, mapMatrix);
    thumb.appendChild(boardElement);

    const actions = document.createElement("div");
    actions.className = "map-card-actions";

    const btnLoad = document.createElement("button");
    btnLoad.className = "btn primary btn-full";
    btnLoad.innerHTML = isCurrentMap ? "📝 继续编辑" : "📥 加载地图";
    btnLoad.onclick = () => {
      try {
        state.map = decodeUrlSafeBase64ToMap(mapObj.data);
      } catch (e) {
        alert("该地图数据损坏，无法加载。");
        return;
      }
      setCurrentMapId(mapObj.id);
      saveMap();
      renderEditorBoard();
      hideMapList();
    };

    const btnRename = document.createElement("button");
    btnRename.className = "btn warning";
    btnRename.innerHTML = "✏️ 重命名";
    btnRename.onclick = () => {
      const newName = prompt("请输入新名称:", mapObj.name);
      if (newName && newName.trim() !== "") {
        mapObj.name = newName.trim();
        setMapList(maps);
        renderMapList();
      }
    };

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn danger";
    btnDelete.innerHTML = "🗑️ 删除";
    btnDelete.onclick = () => {
      if (isCurrentMap) {
        alert("当前编辑地图不能删除，请先新建或加载其他地图。");
        return;
      }
      if (confirm(`确定要删除地图"${mapObj.name}"吗？`)) {
        const newList = maps.filter((m) => m.id !== mapObj.id);
        setMapList(newList);
        renderMapList();
      }
    };

    actions.appendChild(btnLoad);
    actions.appendChild(btnRename);
    actions.appendChild(btnDelete);

    card.appendChild(header);
    card.appendChild(thumb);
    card.appendChild(actions);

    els.mapListGrid.appendChild(card);
  });
}

function createNewMap() {
  const defaultName = `新${formatDefaultMapName()}`;
  const name = prompt("请输入新地图名称:", defaultName);
  if (!name || name.trim() === "") return;

  state.map = createEmptyMapMatrix();
  saveMap({ forceNewMap: true, mapName: name.trim() });
  renderEditorBoard();
  hideMapList();
}
