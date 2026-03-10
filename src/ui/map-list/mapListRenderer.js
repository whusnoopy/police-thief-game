import { renderBoard } from "../board/boardRenderer.js";
import { escapeHTML } from "../../utils/helpers.js";

function createMapActions({ mapObj, isCurrentMap, onLoad, onRename, onDelete, onShare, onDuplicate }) {
  const actions = document.createElement("div");
  actions.className = "map-card-actions";

  const btnLoad = document.createElement("button");
  btnLoad.className = "btn primary btn-full";
  btnLoad.innerHTML = isCurrentMap ? "📝 继续编辑" : "📥 加载地图";
  btnLoad.onclick = () => onLoad(mapObj);

  const btnRename = document.createElement("button");
  btnRename.className = "btn warning";
  btnRename.innerHTML = "✏️ 重命名";
  btnRename.onclick = () => onRename(mapObj);

  const btnDelete = document.createElement("button");
  btnDelete.className = "btn danger";
  btnDelete.innerHTML = "🗑️ 删除";
  btnDelete.onclick = () => onDelete(mapObj);

  const btnShare = document.createElement("button");
  btnShare.className = "btn info";
  btnShare.innerHTML = "🔗 分享";
  btnShare.onclick = () => onShare(mapObj);

  const btnDuplicate = document.createElement("button");
  btnDuplicate.className = "btn secondary";
  btnDuplicate.innerHTML = "📄 复制";
  btnDuplicate.onclick = () => onDuplicate(mapObj);

  actions.append(btnLoad, btnShare, btnDuplicate, btnRename, btnDelete);
  return actions;
}

function createMapCard({ mapObj, currentMapId, resolveMapDefinition, onLoad, onRename, onDelete, onShare, onDuplicate }) {
  const card = document.createElement("div");
  card.className = "map-card";

  const isCurrentMap = mapObj.id === currentMapId;
  if (isCurrentMap) card.classList.add("current-map");

  const header = document.createElement("div");
  header.className = "map-card-header";
  const dateText = new Date(mapObj.updatedAt).toLocaleString();
  header.innerHTML = `
      <span class="map-card-title">${escapeHTML(mapObj.name)}</span>
      <span class="map-card-date">最后修改：${dateText}</span>
    `;

  if (isCurrentMap) {
    const cornerBadge = document.createElement("div");
    cornerBadge.className = "map-card-corner-badge";
    cornerBadge.innerHTML = "<span>编辑中</span>";
    card.appendChild(cornerBadge);
  }

  const thumb = document.createElement("div");
  thumb.className = "map-card-thumb";
  const boardElement = document.createElement("div");
  boardElement.className = "board grid-10x10 mini-board";
  renderBoard(boardElement, { mapDefinition: resolveMapDefinition(mapObj) });
  thumb.appendChild(boardElement);

  card.append(
    header,
    thumb,
    createMapActions({
      mapObj,
      isCurrentMap,
      onLoad,
      onRename,
      onDelete,
      onShare,
      onDuplicate,
    }),
  );

  return card;
}

export function renderMapListGrid(container, options) {
  const {
    maps,
    currentMapId,
    resolveMapDefinition,
    onLoad,
    onRename,
    onDelete,
    onShare,
    onDuplicate,
  } = options;

  container.innerHTML = "";
  maps.forEach((mapObj) => {
    container.appendChild(
      createMapCard({
        mapObj,
        currentMapId,
        resolveMapDefinition,
        onLoad,
        onRename,
        onDelete,
        onShare,
        onDuplicate,
      }),
    );
  });
}

export function setMapListEmptyState(emptyElement, isEmpty) {
  emptyElement.classList.toggle("hidden", !isEmpty);
}
