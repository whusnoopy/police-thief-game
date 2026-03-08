function initEditor() {
  els.palette.innerHTML = "";
  Object.values(TILE_TYPES).forEach((type) => {
    const item = document.createElement("div");
    item.className = `palette-item ${type.id === state.currentPaletteType ? "active" : ""}`;
    item.dataset.type = type.id;
    item.innerHTML = `<span class="palette-icon">${type.emoji}</span><span class="palette-name">${type.name}</span>`;
    item.addEventListener("click", () => {
      document
        .querySelectorAll(".palette-item")
        .forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
      state.currentPaletteType = type.id;
    });
    els.palette.appendChild(item);
  });

  els.btnClearMap.addEventListener("click", clearMap);
}

function renderEditorBoard() {
  els.editorBoard.innerHTML = "";
  let isMouseDown = false;

  document.addEventListener("mousedown", () => (isMouseDown = true));
  document.addEventListener("mouseup", () => (isMouseDown = false));

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement("div");

      const updateCellDOM = (element, r, c) => {
        const tileType = state.map[r][c];
        element.className = `cell type-${tileType}`;
        element.innerHTML = "";

        if (
          TILE_TYPES[tileType].isSpawn ||
          (tileType !== "GRASS" && tileType !== "ROAD")
        ) {
          const marker = document.createElement("span");
          marker.className = "marker";
          marker.textContent = TILE_TYPES[tileType].emoji;
          element.appendChild(marker);
        }
      };

      updateCellDOM(cell, r, c);

      const paint = () => {
        if (state.map[r][c] !== state.currentPaletteType) {
          state.map[r][c] = state.currentPaletteType;
          updateCellDOM(cell, r, c);
          saveMap();
        }
      };

      cell.addEventListener("mousedown", (e) => {
        e.preventDefault();
        paint();
      });

      cell.addEventListener("mouseenter", () => {
        if (isMouseDown) paint();
      });

      els.editorBoard.appendChild(cell);
    }
  }
}

function getStoredBase64Map() {
  const saved = localStorage.getItem("policeThiefMap");
  if (!saved) return null;
  // Check if it's old JSON format
  if (saved.startsWith("[")) {
    try {
      const parsed = JSON.parse(saved);
      // Migrate to new base64
      const b64 = encodeMapToUrlSafeBase64(parsed);
      localStorage.setItem("policeThiefMap", b64);
      return b64;
    } catch (e) {
      return null;
    }
  }
  return saved;
}

function saveMap(options = {}) {
  const { forceNewMap = false, mapName = null } = options;
  const b64 = encodeMapToUrlSafeBase64(state.map);
  localStorage.setItem("policeThiefMap", b64);
  if (typeof upsertCurrentMapInList === "function") {
    upsertCurrentMapInList(b64, { forceNew: forceNewMap, name: mapName });
  }
  updateMapUrl();
}

function updateMapUrl() {
  const encodedMap = encodeMapToUrlSafeBase64(state.map);
  const newUrl =
    window.location.protocol +
    "//" +
    window.location.host +
    window.location.pathname +
    "?m=" +
    encodedMap;
  window.history.replaceState({ path: newUrl }, "", newUrl);
}

function loadMap() {
  let loadedFromUrl = false;
  let shouldCreateNewMap = false;
  const savedB64 = getStoredBase64Map();
  const urlParams = new URLSearchParams(window.location.search);
  const m = urlParams.get("m");
  if (m && (m.length === 50 || m.length === 100)) {
    try {
      state.map = decodeUrlSafeBase64ToMap(m);
      loadedFromUrl = true;
      shouldCreateNewMap = !!savedB64 && savedB64 !== m;
    } catch (e) {
      console.error("Failed to parse map from URL");
    }
  }

  if (!loadedFromUrl) {
    if (savedB64) {
      try {
        state.map = decodeUrlSafeBase64ToMap(savedB64);
      } catch (e) {
        console.error("Failed to load map");
      }
    }
  }

  saveMap({ forceNewMap: shouldCreateNewMap });
}

function clearMap() {
  if (confirm("确定要清空地图吗？所有地块将被重置为草地。")) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        state.map[r][c] = "GRASS";
      }
    }
    renderEditorBoard();
    saveMap();
  }
}

function validateMap() {
  let hasPolice = false;
  let hasThief = false;

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (state.map[r][c] === "POLICE_SPAWN") hasPolice = true;
      if (state.map[r][c] === "THIEF_SPAWN") hasThief = true;
    }
  }

  if (!hasPolice || !hasThief) {
    alert("必须至少放置一个警察出生点和一个小偷出生点！");
    return false;
  }
  return true;
}
