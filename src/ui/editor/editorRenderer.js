import { renderTileIcon } from '../board/storybookArt.js';
import { BRIDGE_DIRECTIONS, RAMP_TILE_TYPES } from '../../domain/map/bridgeTopology.js';

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
    ],
  },
  {
    id: "bridge-facilities",
    name: "高架桥设施",
    tileIds: ["OVERPASS", ...RAMP_TILE_TYPES],
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
  ...Object.fromEntries(BRIDGE_DIRECTIONS.map(({ direction, name }) => [`OVERPASS_RAMP_${direction}`, {
    summary: `向${name}上坡，反向可下桥；两侧封闭。`,
    details: ["高端连接普通高架，低端连接可驾车的陆上地块。", "只允许车辆，每格基础费用 0.25 点。", "按 T、3 后可用方向键选坡道，R 轮换方向。在已有坡道上绘制可改变方向。"],
  }])),
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
    details: ["警察和小偷都可步行进入。", "步行每格消耗 1 步。", "开车每格基础费用为 0.5 点。"],
  },
  RIVER: {
    summary: "不可通行的水面。",
    details: ["行人和汽车均不能进入。", "可以用堤道或高架桥连接两岸。"],
  },
  OVERPASS: {
    summary: "高速车行地块，只允许车辆通过。",
    details: ["步行不能进入。", "车辆可通行，每格基础费用为 0.25 点。"],
  },
  MOUNTAIN: {
    summary: "山可相邻组成山脉，外围保留草地缓冲。",
    details: ["所有人、车辆和动物都不能进入。", "上下左右已有的山会保留，其余邻格自动变草地；斜角不受限制。", "草地缓冲可继续扩建成山；仍挨着山的格子只能是山或草地。", "若会覆盖设施或出生点，则不能放置。"],
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
    details: ["只有警察可进入。", "警察押送小偷进警察局后，可恢复继续抓捕。", "小偷多于警察时，必须有可到达的警察局。"],
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
    details: ["警察和小偷都可进入；动物所在格不可进入。", "每轮在相邻且有出口的空格刷新动物，最多 3 只。", "受困 3 轮或停留 6 轮后回农场，回场当轮不补刷。"],
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

const CONTINUOUS_HELP = {
  BANK: { summary: "小偷到位后取钱的地点。", details: ["警察和小偷都可进入。", "小偷到位后点击取钱，移动费之外另付 1 点；经过不会自动取钱。", "银行的钱不会被取空。"] },
  PARKING: { summary: "提供车辆及停车下车的地点。", details: ["到空车处后可点击上车，另付 1 点。", "驾车可在无车停车场点击下车，另付 1 点。", "移动到位不自动上/下车，余额可继续使用。"] },
  POLICE_STATION: { summary: "警察专属的交付地点。", details: ["只有警察可进入。", "押送到位后点击交付，另付 1 点，再次恢复抓捕能力。", "驾车到达需先下车 1 点、再交付 1 点。"] },
};

function getFallbackHelp() {
  return {
    summary: "基础地块。",
    details: ["该地块尚未配置详细玩法说明。"],
  };
}

function renderTileHelpPanel(panel, type, continuousRules = false) {
  const help = (continuousRules && CONTINUOUS_HELP[type.id]) || TILE_HELP[type.id] || getFallbackHelp(type);
  panel.innerHTML = "";
  panel.dataset.type = type.id;

  const title = document.createElement("strong");
  title.className = "tile-help-title";
  title.textContent = type.name;

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

function createTileHelpPanel(type, continuousRules) {
  const panel = document.createElement("div");
  panel.id = "tile-help-panel";
  panel.className = "tile-help-panel";
  panel.setAttribute("aria-live", "polite");
  renderTileHelpPanel(panel, type, continuousRules);
  return panel;
}

function createShortcutKey(number) {
  const key = document.createElement("kbd");
  key.className = "palette-shortcut-key";
  key.textContent = String(number);
  return key;
}

function createPaletteItem(type, number, currentPaletteType, onPreview, onSelect) {
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
  renderTileIcon(icon, type.id);

  const name = document.createElement("span");
  name.className = "palette-name";
  const ramp = BRIDGE_DIRECTIONS[RAMP_TILE_TYPES.indexOf(type.id)];
  name.textContent = ramp ? `向${ramp.name}上坡` : type.name;

  item.append(createShortcutKey(number), icon, name);
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
  number,
  groupTileTypes,
  currentPaletteType,
  onPreview,
  onSelect,
  onOpen,
) {
  const details = document.createElement("details");
  details.className = "palette-group";
  details.dataset.group = group.id;
  details.dataset.name = group.name;
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
  count.textContent = `${groupTileTypes.length} 种`;

  summary.append(createShortcutKey(number), title, count);

  const grid = document.createElement("div");
  grid.className = "palette-grid";
  groupTileTypes.forEach((type, index) => {
    grid.appendChild(createPaletteItem(type, index + 1, currentPaletteType, onPreview, onSelect));
  });

  details.append(summary, grid);
  return details;
}

export function renderPalette(container, { tileTypes, currentPaletteType, onSelect, rampRules = false, continuousRules = false }) {
  container.innerHTML = "";

  const typeById = new Map(tileTypes.map((type) => [type.id, type]));
  const groupedIds = new Set();
  let selectedTileType = typeById.has(currentPaletteType) ? currentPaletteType : tileTypes[0]?.id;
  const initialTileType = typeById.get(selectedTileType) || tileTypes[0];
  const helpPanel = createTileHelpPanel(initialTileType, continuousRules);

  function previewTileHelp(typeId) {
    const type = typeById.get(typeId);
    if (type) {
      renderTileHelpPanel(helpPanel, type, continuousRules);
      if (rampRules && typeId === "OVERPASS") {
        const extra = document.createElement("span");
        extra.textContent = "桥面不能直接进出相邻地面，请使用有方向的上下桥格。";
        helpPanel.appendChild(extra);
      }
    }
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
      paletteGroups.length + 1,
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
      paletteGroups.length + 1,
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

  container.onmouseleave = restoreSelectedTileHelp;
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
