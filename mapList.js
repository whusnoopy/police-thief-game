function generateMapId() {
  return "map_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

function getMapList() {
  const listStr = localStorage.getItem("policeThiefMapList");
  if (!listStr) return [];
  try {
    return JSON.parse(listStr);
  } catch (e) {
    return [];
  }
}

function setMapList(list) {
  localStorage.setItem("policeThiefMapList", JSON.stringify(list));
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

function renderBoardDOM(container, mapMatrix, isMini) {
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
  els.mapListGrid.innerHTML = "";

  if (maps.length === 0) {
    els.mapListEmpty.classList.remove("hidden");
  } else {
    els.mapListEmpty.classList.add("hidden");

    maps.forEach((mapObj) => {
      const card = document.createElement("div");
      card.className = "map-card";

      const header = document.createElement("div");
      header.className = "map-card-header";
      header.innerHTML = `
        <span class="map-card-title">${escapeHTML(mapObj.name)}</span>
        <span class="map-card-date">${new Date(mapObj.date).toLocaleDateString()}</span>
      `;

      const thumb = document.createElement("div");
      thumb.className = "map-card-thumb";
      const boardElement = document.createElement("div");
      boardElement.className = "board grid-10x10 mini-board";

      // Decode and render mini board
      const mapMatrix = decodeUrlSafeBase64ToMap(mapObj.data);
      renderBoardDOM(boardElement, mapMatrix, true);
      thumb.appendChild(boardElement);

      const actions = document.createElement("div");
      actions.className = "map-card-actions";

      const btnLoad = document.createElement("button");
      btnLoad.className = "btn primary btn-full";
      btnLoad.innerHTML = "📥 加载地图";
      btnLoad.onclick = () => {
        if (
          confirm(`确定要加载地图"${mapObj.name}"吗？当前未保存的更改将丢失。`)
        ) {
          state.map = mapMatrix;
          saveMap();
          renderEditorBoard();
          hideMapList();
        }
      };

      const btnRename = document.createElement("button");
      btnRename.className = "btn warning";
      btnRename.innerHTML = "✏️ 重命名";
      btnRename.onclick = () => {
        const newName = prompt("请输入新名称:", mapObj.name);
        if (newName && newName.trim() !== "") {
          mapObj.name = newName.trim();
          setMapList(maps); // Save updated map reference
          renderMapList();
        }
      };

      const btnDelete = document.createElement("button");
      btnDelete.className = "btn danger";
      btnDelete.innerHTML = "🗑️ 删除";
      btnDelete.onclick = () => {
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
}

function saveMapAsNew() {
  const pad = (num) => String(num).padStart(2, "0");

  const date = new Date();
  const month = pad(date.getMonth() + 1); // 注意：月份是从 0 开始的，必须 +1
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  const defaultName = `地图 ${month}/${day} ${hours}:${minutes}`;
  const name = prompt("给新保存的地图起个名字:", defaultName);
  if (!name || name.trim() === "") return;

  const maps = getMapList();
  const b64 = encodeMapToUrlSafeBase64(state.map);

  maps.unshift({
    id: generateMapId(),
    name: name.trim(),
    data: b64,
    date: Date.now(),
  });

  setMapList(maps);
  renderMapList();
}
