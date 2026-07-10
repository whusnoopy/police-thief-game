const PALETTE_GROUPS = [
  {
    id: "terrain",
    name: "地形",
    tileIds: [
      "GRASS",
      "ROAD",
      "RIVER",
      "MOUNTAIN",
    ],
  },
  {
    id: "building-facilities",
    name: "建筑设施",
    tileIds: [
      "BUILDING",
      "CONSTRUCTION_SITE",
      "BARRIER",
      "CROSSWALK_HORIZONTAL",
      "CROSSWALK_VERTICAL",
      "OVERPASS",
    ],
  },
  {
    id: "spawns",
    name: "出生点",
    tileIds: [
      "POLICE_STATION",
      "THIEF_BASE",
      "BANK",
      "THIEF_SPAWN",
      "POLICE_SPAWN",
    ],
  },
  {
    id: "special",
    name: "特殊区块",
    tileIds: [
      "MANHOLE",
      "PARKING",
      "FARM",
    ],
  },
];

const REQUIRED_TILE_LABELS = {
  POLICE_SPAWN: "警察出生点",
  THIEF_SPAWN: "小偷出生点",
  THIEF_BASE: "小偷基地",
  BANK: "银行",
};

const TILE_HELP = {
  GRASS: {
    summary: "普通可通行地形，行人移动较慢。",
    details: ["警察和小偷都可进入。", "步行每格消耗 2 步。", "车辆不能驶入。"],
  },
  BUILDING: {
    summary: "固定障碍，用来阻断路线。",
    details: ["警察和小偷都不能进入。", "车辆也不能通过。"],
  },
  CONSTRUCTION_SITE: {
    summary: "施工障碍，制造不可通行区域。",
    details: ["警察和小偷都不能进入。", "车辆也不能通过。"],
  },
  BARRIER: {
    summary: "路障会完全封锁该格。",
    details: ["警察和小偷都不能进入。", "车辆也不能通过。"],
  },
  ROAD: {
    summary: "标准地块，适合作为主要路线。",
    details: ["警察和小偷都可步行进入。", "步行每格消耗 1 步。", "开车每格消耗 0.5 步。"],
  },
  RIVER: {
    summary: "水路地块，只允许车辆通过。",
    details: ["步行不能进入。", "车辆可通行，每格消耗 2 步。"],
  },
  OVERPASS: {
    summary: "高速车行地块，只允许车辆通过。",
    details: ["步行不能进入。", "车辆可通行，每格消耗 0.25 步。"],
  },
  MOUNTAIN: {
    summary: "不可通行地形，放置时会影响上下左右四格。",
    details: ["所有人、车辆和动物都不能进入。", "上下左右四格会被强制设为草地。", "如果会覆盖特殊格，则不能放置。"],
  },
  CROSSWALK_HORIZONTAL: {
    summary: "横向斑马线，受全局红绿灯限制。",
    details: ["行人绿灯时可左右通过。", "车辆红灯时可上下穿过。", "步行 1 步，开车 0.5 步。"],
  },
  CROSSWALK_VERTICAL: {
    summary: "纵向斑马线，受全局红绿灯限制。",
    details: ["行人绿灯时可上下通过。", "车辆红灯时可左右穿过。", "步行 1 步，开车 0.5 步。"],
  },
  POLICE_STATION: {
    summary: "警察专属地点。",
    details: ["只有警察可进入。", "警察押送小偷进警察局后，可恢复继续抓捕。"],
  },
  THIEF_BASE: {
    summary: "小偷逃脱终点。",
    details: ["只有小偷可进入。", "小偷必须先从银行拿到钱，回到基地才算逃脱。"],
  },
  BANK: {
    summary: "小偷取钱地点，开始必需地块。",
    details: ["警察和小偷都可进入。", "小偷进入后会携带钱。", "银行的钱不会被取空。"],
  },
  FARM: {
    summary: "会生成动物的可通行地点。",
    details: ["警察和小偷都可进入。", "每个完整回合后，农场会尝试在相邻可通行格生成动物。", "动物所在格不可进入。"],
  },
  PARKING: {
    summary: "提供车辆的地点。",
    details: ["警察和小偷都可进入。", "步行进入空车会自动上车并结束行动。", "驾车以无车停车场为终点时自动下车。"],
  },
  MANHOLE: {
    summary: "小偷可用的传送点。",
    details: ["警察进入时等同道路。", "小偷站在井盖上可花 1 步传送到任意其他井盖。"],
  },
  POLICE_SPAWN: {
    summary: "警察开局位置，游戏必需地块。",
    details: ["警察会从这里出生。", "移动规则等同道路。", "可放置多个出生点。"],
  },
  THIEF_SPAWN: {
    summary: "小偷开局位置，游戏必需地块。",
    details: ["小偷会从这里出生。", "移动规则等同道路。", "可放置多个出生点。"],
  },
};

function getFallbackHelp() {
  return {
    summary: "基础地块。",
    details: ["该地块尚未配置详细玩法说明。"],
  };
}

function renderTileHelpPanel(panel, type) {
  const help = TILE_HELP[type.id] || getFallbackHelp(type);
  panel.innerHTML = "";
  panel.dataset.type = type.id;

  const title = document.createElement("strong");
  title.className = "tile-help-title";
  title.textContent = `${type.emoji} ${type.name}`;

  const summary = document.createElement("span");
  summary.className = "tile-help-summary";
  summary.textContent = help.summary;

  const detailList = document.createElement("span");
  detailList.className = "tile-help-details";
  help.details.forEach((detail) => {
    const detailItem = document.createElement("span");
    detailItem.textContent = detail;
    detailList.appendChild(detailItem);
  });

  panel.append(title, summary, detailList);
}

function createTileHelpPanel(type) {
  const panel = document.createElement("div");
  panel.id = "tile-help-panel";
  panel.className = "tile-help-panel";
  panel.setAttribute("aria-live", "polite");
  renderTileHelpPanel(panel, type);
  return panel;
}

function createPaletteItem(type, currentPaletteType, onPreview, onSelect) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = `palette-item ${type.id === currentPaletteType ? "active" : ""}`;
  item.dataset.type = type.id;
  item.dataset.name = type.name;
  item.setAttribute("aria-label", type.name);
  item.setAttribute("aria-pressed", type.id === currentPaletteType ? "true" : "false");
  item.setAttribute("aria-describedby", "tile-help-panel");

  const icon = document.createElement("span");
  icon.className = "palette-icon";
  icon.textContent = type.emoji;

  const name = document.createElement("span");
  name.className = "palette-name";
  name.textContent = type.name;

  item.append(icon, name);
  if (REQUIRED_TILE_LABELS[type.id]) {
    const requirement = document.createElement("span");
    requirement.className = "palette-requirement-status missing";
    requirement.dataset.requiredType = type.id;
    requirement.textContent = "!";
    requirement.title = `${REQUIRED_TILE_LABELS[type.id]}：当前地图缺失`;
    requirement.setAttribute("aria-hidden", "true");
    item.appendChild(requirement);
  }

  item.addEventListener("mouseenter", () => onPreview(type.id));
  item.addEventListener("focus", () => onPreview(type.id));
  item.addEventListener("click", () => {
    onSelect(type.id, item);
  });

  return item;
}

function createPaletteGroup(
  group,
  groupTileTypes,
  currentPaletteType,
  onPreview,
  onSelect,
  onOpen,
) {
  const details = document.createElement("details");
  details.className = "palette-group";
  details.dataset.group = group.id;
  details.open = groupTileTypes.some((type) => type.id === currentPaletteType);
  details.addEventListener("toggle", () => {
    if (details.open) onOpen(details);
  });

  const summary = document.createElement("summary");
  summary.className = "palette-group-title";

  const title = document.createElement("span");
  title.textContent = group.name;

  const count = document.createElement("span");
  count.className = "palette-group-count";
  count.textContent = `${groupTileTypes.length}`;

  summary.append(title, count);

  const grid = document.createElement("div");
  grid.className = "palette-grid";
  groupTileTypes.forEach((type) => {
    grid.appendChild(createPaletteItem(type, currentPaletteType, onPreview, onSelect));
  });

  details.append(summary, grid);
  return details;
}

export function renderPalette(container, { tileTypes, currentPaletteType, onSelect }) {
  container.innerHTML = "";

  const typeById = new Map(tileTypes.map((type) => [type.id, type]));
  const groupedIds = new Set();
  let selectedTileType = typeById.has(currentPaletteType) ? currentPaletteType : tileTypes[0]?.id;
  const initialTileType = typeById.get(selectedTileType) || tileTypes[0];
  const helpPanel = createTileHelpPanel(initialTileType);

  function previewTileHelp(typeId) {
    const type = typeById.get(typeId);
    if (type) renderTileHelpPanel(helpPanel, type);
  }

  function restoreSelectedTileHelp() {
    previewTileHelp(selectedTileType);
  }

  function selectTile(typeId, item) {
    selectedTileType = typeId;
    previewTileHelp(typeId);
    onSelect(typeId, item);
  }

  const paletteGroups = [];

  function handleGroupOpen(openGroup) {
    paletteGroups.forEach((groupElement) => {
      if (groupElement !== openGroup) {
        groupElement.open = false;
      }
    });
  }

  PALETTE_GROUPS.forEach((group) => {
    const groupTileTypes = group.tileIds.map((tileId) => typeById.get(tileId)).filter(Boolean);
    if (groupTileTypes.length === 0) return;

    group.tileIds.forEach((tileId) => groupedIds.add(tileId));
    const groupElement = createPaletteGroup(
      group,
      groupTileTypes,
      currentPaletteType,
      previewTileHelp,
      selectTile,
      handleGroupOpen,
    );
    paletteGroups.push(groupElement);
    container.appendChild(groupElement);
  });

  const ungroupedTileTypes = tileTypes.filter((type) => !groupedIds.has(type.id));
  if (ungroupedTileTypes.length > 0) {
    const groupElement = createPaletteGroup(
      { id: "other", name: "其他地块" },
      ungroupedTileTypes,
      currentPaletteType,
      previewTileHelp,
      selectTile,
      handleGroupOpen,
    );
    paletteGroups.push(groupElement);
    container.appendChild(groupElement);
  }

  container.appendChild(helpPanel);

  container.addEventListener("mouseleave", restoreSelectedTileHelp);
}

export function updatePaletteRequirementStatus(container, requiredStatus = {}) {
  container.querySelectorAll(".palette-item").forEach((item) => {
    const typeId = item.dataset.type;
    if (!REQUIRED_TILE_LABELS[typeId]) return;

    const badge = item.querySelectorAll(".palette-requirement-status")[0];
    if (!badge) return;

    const isPresent = Boolean(requiredStatus[typeId]);
    const label = REQUIRED_TILE_LABELS[typeId];
    const statusText = isPresent ? "已放置" : "当前地图缺失";

    badge.classList.toggle("present", isPresent);
    badge.classList.toggle("missing", !isPresent);
    badge.textContent = isPresent ? "✓" : "!";
    badge.title = `${label}：${statusText}`;
    item.setAttribute("aria-label", `${item.dataset.name}，必需地块，${statusText}`);
  });
}
